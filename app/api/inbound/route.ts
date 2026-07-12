import { NextResponse } from "next/server";
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runCheck, docPaths } from "@/lib/pipeline/run";

/**
 * Email-in checks. Point your inbound email provider (Resend Inbound,
 * SendGrid Inbound Parse, Cloudflare Email Workers) at this endpoint with a
 * JSON payload:
 *   { token, subject, attachments: [{ filename, contentBase64 }] }
 * `token` is the agency's inbound token (Settings → Integrations), carried
 * in the address (checks+<token>@in.boundright.app) or the payload.
 * The first two PDF attachments become document A and B of an issuance check.
 */
export async function POST(request: Request) {
  // Roadmap feature: endpoint stays dormant until explicitly enabled.
  if (process.env.EMAIL_INTAKE_ENABLED !== "1") {
    return NextResponse.json({ error: "email intake is not enabled" }, { status: 503 });
  }
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "not configured" }, { status: 503 });

  let payload: {
    token?: string;
    subject?: string;
    attachments?: { filename?: string; contentBase64?: string }[];
  };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  const token = String(payload.token ?? "");
  if (!token) return NextResponse.json({ error: "missing token" }, { status: 401 });
  const { data: agency } = await admin
    .from("agencies")
    .select("id, billing_status")
    .eq("inbound_token", token)
    .maybeSingle();
  if (!agency) return NextResponse.json({ error: "unknown token" }, { status: 401 });
  if (agency.billing_status === "canceled") {
    return NextResponse.json({ error: "subscription ended" }, { status: 403 });
  }

  const pdfs = (payload.attachments ?? []).filter(
    (a) => a.filename?.toLowerCase().endsWith(".pdf") && a.contentBase64
  );
  if (pdfs.length < 2) {
    return NextResponse.json(
      { error: "attach two PDFs: the proposal/binder and the issued policy" },
      { status: 422 }
    );
  }

  // Heuristic ordering: a filename mentioning proposal/binder/quote goes first.
  const isSource = (name: string) => /proposal|binder|quote/i.test(name);
  const [first, second] = pdfs;
  const [docA, docB] = isSource(second.filename!) && !isSource(first.filename!)
    ? [second, first]
    : [first, second];

  const label = (payload.subject ?? "Emailed check").slice(0, 120);
  const { data: check, error } = await admin
    .from("checks")
    .insert({
      agency_id: agency.id,
      label,
      policy_type: "Other",
      check_type: "issuance",
      status: "queued",
      source: "email",
      doc_a_filename: docA.filename,
      doc_b_filename: docB.filename,
    })
    .select("id")
    .single();
  if (error || !check) return NextResponse.json({ error: "create failed" }, { status: 500 });

  const paths = docPaths(check.id);
  for (const [p, doc] of [
    [paths.a, docA],
    [paths.b, docB],
  ] as const) {
    const { error: upErr } = await admin.storage
      .from("documents")
      .upload(p, Buffer.from(doc.contentBase64!, "base64"), {
        contentType: "application/pdf",
      });
    if (upErr) {
      await admin.from("checks").delete().eq("id", check.id);
      return NextResponse.json({ error: "upload failed" }, { status: 500 });
    }
  }

  await admin.from("events").insert({
    agency_id: agency.id,
    event_name: "check_created",
    metadata: { check_id: check.id, source: "email" },
  });

  after(async () => {
    await runCheck(check.id);
  });

  return NextResponse.json({ ok: true, checkId: check.id });
}
