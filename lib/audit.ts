import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Append-only audit writer. Never blocks the caller; the table has no
 * update/delete grants, so entries are immutable once written.
 */
export async function auditLog(entry: {
  agencyId: string;
  checkId?: string | null;
  checkLabel?: string | null;
  userId?: string | null;
  action: string;
  detail?: Record<string, unknown>;
}): Promise<void> {
  const admin = createAdminClient();
  if (!admin) return;
  try {
    await admin.from("check_audit").insert({
      agency_id: entry.agencyId,
      check_id: entry.checkId ?? null,
      check_label: entry.checkLabel ?? null,
      user_id: entry.userId ?? null,
      action: entry.action,
      detail: entry.detail ?? {},
    });
  } catch (err) {
    console.error("audit write failed:", err instanceof Error ? err.message : err);
  }
}
