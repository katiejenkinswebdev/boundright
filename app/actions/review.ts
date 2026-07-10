"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";

export type ReviewResult = { ok: true } | { ok: false; message: string };

/** Confirm or dismiss a finding, with an optional reviewer note. RLS scopes access. */
export async function setFindingReview(
  findingId: string,
  action: "confirmed" | "dismissed",
  note: string
): Promise<ReviewResult> {
  const { supabase } = await requireProfile();
  const { data, error } = await supabase
    .from("findings")
    .update({
      reviewer_action: action,
      reviewer_note: note.trim() ? note.trim().slice(0, 2000) : null,
    })
    .eq("id", findingId)
    .select("id, check_id")
    .maybeSingle();
  if (error || !data) return { ok: false, message: "Couldn't save that. Try again." };
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

  revalidatePath(`/checks/${checkId}`);
  return { ok: true };
}
