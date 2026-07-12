import { requireProfile } from "@/lib/auth";
import { isSystemAdmin } from "@/lib/roles";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * System-admin audit log export for a client agency: every action on every
 * check with actor and timestamp, ordered by check then time. CSV.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ agencyId: string }> }
) {
  const { profile } = await requireProfile();
  if (!isSystemAdmin(profile)) return new Response("Not found", { status: 404 });
  const { agencyId } = await params;
  const admin = createAdminClient();
  if (!admin) return new Response("Not configured", { status: 503 });

  const [{ data: agency }, { data: rows }, { data: people }] = await Promise.all([
    admin.from("agencies").select("name").eq("id", agencyId).single(),
    admin
      .from("check_audit")
      .select("*")
      .eq("agency_id", agencyId)
      .order("check_id", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(20000),
    admin.from("profiles").select("user_id, full_name").eq("agency_id", agencyId),
  ]);
  if (!agency) return new Response("Unknown agency", { status: 404 });

  const nameByUser = new Map((people ?? []).map((p) => [p.user_id, p.full_name]));
  const esc = (v: unknown) => `"${String(v ?? "").replaceAll('"', '""')}"`;
  const lines = [
    ["timestamp_utc", "check_id", "check_label", "action", "actor", "detail"].join(","),
    ...(rows ?? []).map((r) =>
      [
        esc(r.created_at),
        esc(r.check_id),
        esc(r.check_label),
        esc(r.action),
        esc(r.user_id ? (nameByUser.get(r.user_id) ?? r.user_id) : "system"),
        esc(JSON.stringify(r.detail)),
      ].join(",")
    ),
  ];

  await admin.from("events").insert({
    agency_id: agencyId,
    user_id: profile.user_id,
    event_name: "audit_log_exported",
    metadata: { rows: rows?.length ?? 0 },
  });

  const today = new Date().toISOString().slice(0, 10);
  const safe = agency.name.replace(/[^a-zA-Z0-9 _-]/g, "").trim();
  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="BoundRight - Audit Log - ${safe} - ${today}.csv"`,
    },
  });
}
