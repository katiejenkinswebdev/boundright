"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { auditLog } from "@/lib/audit";

export type ReviewResult = { ok: true } | { ok: false; message: string };

/** Confirm or dismiss a finding, with an optional reviewer note. RLS scopes access. */
const DISMISS_REASONS = [
  "not_a_discrepancy",
  "wrong_extraction",
  "duplicate",
  "known_intentional",
  "other",
];

export async function setFindingReview(
  findingId: string,
  action: "confirmed" | "dismissed",
  note: string,
  dismissReason?: string
): Promise<ReviewResult> {
  const { supabase } = await requireProfile();
  const reason =
    action === "dismissed" && dismissReason && DISMISS_REASONS.includes(dismissReason)
      ? dismissReason
      : null;
  const { data, error } = await supabase
    .from("findings")
    .update({
      reviewer_action: action,
      reviewer_note: note.trim() ? note.trim().slice(0, 2000) : null,
      dismiss_reason: reason,
    })
    .eq("id", findingId)
    .select("id, check_id")
    .maybeSingle();
  if (error || !data) return { ok: false, message: "Couldn't save that. Try again." };
  const { profile: p2, agency: a2 } = await requireProfile();
  await auditLog({
    agencyId: a2.id,
    checkId: data.check_id,
    userId: p2.user_id,
    action: action === "confirmed" ? "finding_confirmed" : "finding_dismissed",
    detail: { finding_id: findingId, dismiss_reason: reason ?? undefined },
  });
  revalidatePath(`/checks/${data.check_id}`);
  return { ok: true };
}

/**
 * Marks the check reviewed — the human-in-the-loop gate. Requires a reviewer
 * decision on every critical finding first.
 */
export async function markReviewed(checkId: string): Promise<ReviewResult> {
  const { supabase, user } = await requireProfile();

  const { data: unactioned } = await supabase
    .from("findings")
    .select("id")
    .eq("check_id", checkId)
    .eq("severity", "critical")
    .is("reviewer_action", null);
  if (unactioned && unactioned.length > 0) {
    return {
      ok: false,
      message: `Confirm or dismiss all critical findings first (${unactioned.length} remaining).`,
    };
  }

  const { data, error } = await supabase
    .from("checks")
    .update({
      status: "reviewed",
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
    })
    .eq("id", checkId)
    .eq("status", "ready_for_review")
    .select("id")
    .maybeSingle();
  if (error || !data) {
    return { ok: false, message: "Couldn't mark this check reviewed. Try again." };
  }

  const { profile: p3, agency: a3 } = await requireProfile();
  await auditLog({ agencyId: a3.id, checkId, userId: p3.user_id, action: "marked_reviewed" });
  revalidatePath(`/checks/${checkId}`);
  return { ok: true };
}
