"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { auditLog } from "@/lib/audit";
import { canSeeAnalytics } from "@/lib/roles";

export type DeleteResult = { ok: true } | { ok: false; message: string };

/** Deletes a check; findings cascade, dashboard stats adjust automatically. */
export async function deleteCheck(checkId: string): Promise<DeleteResult> {
  const { supabase, profile, agency } = await requireProfile();
  // Deletion is destructive and adjusts metrics: managers and above only.
  if (!canSeeAnalytics(profile)) {
    return { ok: false, message: "Ask a manager or admin to delete checks." };
  }
  const { data: pre } = await supabase.from("checks").select("label").eq("id", checkId).maybeSingle();
  const { data, error } = await supabase
    .from("checks")
    .delete()
    .eq("id", checkId)
    .select("id");
  if (error || !data || data.length === 0) {
    return { ok: false, message: "Couldn't delete that check. Try again." };
  }
  await auditLog({ agencyId: agency.id, checkId, checkLabel: pre?.label, userId: profile.user_id, action: "deleted" });
  revalidatePath("/checks");
  revalidatePath("/dashboard");
  return { ok: true };
}

/** Archive (or restore) a check: list hygiene, never deletion. Metrics keep counting it. */
export async function setCheckArchived(
  checkId: string,
  archived: boolean
): Promise<DeleteResult> {
  const { supabase, profile, agency } = await requireProfile();
  const { data, error } = await supabase
    .from("checks")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", checkId)
    .select("id");
  if (error || !data || data.length === 0) {
    return { ok: false, message: "Couldn't update that check. Try again." };
  }
  await auditLog({ agencyId: agency.id, checkId, userId: profile.user_id, action: archived ? "archived" : "restored" });
  revalidatePath("/checks");
  revalidatePath("/dashboard");
  return { ok: true };
}
