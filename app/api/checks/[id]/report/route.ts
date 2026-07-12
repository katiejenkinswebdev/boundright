import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildReportPdf, type ReportFinding } from "@/lib/report-pdf";

/** Exports the reviewed check as a branded PDF. RLS scopes access. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createServerSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Sign in to export reports.", { status: 401 });

  const { data: check } = await supabase
    .from("checks")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!check) return new Response("Not found", { status: 404 });
  if (check.status !== "reviewed") {
    return new Response("Mark the check reviewed before exporting.", { status: 409 });
  }

  const [{ data: agency }, { data: findings }, { data: reviewer }] =
    await Promise.all([
      supabase.from("agencies").select("name").eq("id", check.agency_id).single(),
      supabase
        .from("findings")
        .select("*")
        .eq("check_id", id)
        .order("created_at", { ascending: true }),
      supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", check.reviewed_by)
        .maybeSingle(),
    ]);

  const fmt = (d: string) =>
    new Date(d).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });

  const reviewed = check.reviewed_at ? new Date(check.reviewed_at) : new Date();
  const stampDateLine = [
    String(reviewed.getMonth() + 1).padStart(2, "0"),
    String(reviewed.getDate()).padStart(2, "0"),
    reviewed.getFullYear(),
  ].join("·");

  // Agency logo for co-branding (public bucket).
  let logo: { bytes: Uint8Array; kind: "png" | "jpg" } | null = null;
  const { data: agencyFull } = await supabase
    .from("agencies")
    .select("logo_url")
    .eq("id", check.agency_id)
    .single();
  if (agencyFull?.logo_url) {
    try {
      const res = await fetch(agencyFull.logo_url);
      if (res.ok) {
        logo = {
          bytes: new Uint8Array(await res.arrayBuffer()),
          kind: agencyFull.logo_url.endsWith(".png") ? "png" : "jpg",
        };
      }
    } catch {
      // co-branding is best-effort
    }
  }

  const pdf = await buildReportPdf({
    agencyName: agency?.name ?? "Agency",
    logo,
    reportId: `BR-${check.id.slice(0, 8).toUpperCase()}`,
    docA: {
      filename: check.doc_a_filename ?? "document_a.pdf",
      pages: check.doc_a_pages,
      sha256: check.doc_a_sha256,
    },
    docB: {
      filename: check.doc_b_filename ?? "document_b.pdf",
      pages: check.doc_b_pages,
      sha256: check.doc_b_sha256,
    },
    receivedAt: check.created_at,
    processedAt: check.processed_at,
    source: check.source,
    label: check.label,
    policyType: check.policy_type,
    runDate: fmt(check.created_at),
    reviewerName: reviewer?.full_name ?? "Licensed agent",
    reviewedDate: check.reviewed_at ? fmt(check.reviewed_at) : fmt(reviewed.toISOString()),
    stampDateLine,
    modelVersion: check.model_version ?? "—",
    promptVersion: check.prompt_version ?? "—",
    scanned: check.doc_a_scanned || check.doc_b_scanned,
    findings: (findings ?? []) as ReportFinding[],
  });

  // Audit trail: record the export (service role; not user-updatable columns).
  const admin = createAdminClient();
  if (admin) {
    await admin
      .from("checks")
      .update({ exported_at: new Date().toISOString() })
      .eq("id", id);
    await admin.from("events").insert({
      agency_id: check.agency_id,
      user_id: user.id,
      event_name: "report_exported",
      metadata: { check_id: id },
    });
  }

  // Naming convention: BoundRight - {Type} - {Client} - {ISO date(s)}.pdf
  const safeLabel = check.label.replace(/[^a-zA-Z0-9 _-]/g, "").slice(0, 60).trim() || "check";
  const dateTag = reviewed.toISOString().slice(0, 10);
  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="BoundRight - Discrepancy Report - ${safeLabel} - ${dateTag}.pdf"`,
    },
  });
}
