"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { draftCorrectionLetter, emptyUsage } from "@/lib/pipeline/claude";
import type { PipelineFinding } from "@/lib/pipeline/schemas";

export type LetterResult = { ok: true; letter: string } | { ok: false; message: string };

/** Drafts the carrier correction request from this check's confirmed findings. */
export async function generateCorrectionLetter(checkId: string): Promise<LetterResult> {
  const { supabase, profile, agency } = await requireProfile();

  const { data: check } = await supabase
    .from("checks")
    .select("*")
    .eq("id", checkId)
    .maybeSingle();
  if (!check) return { ok: false, message: "Check not found." };
  if (check.status !== "reviewed") {
    return { ok: false, message: "Mark the check reviewed first." };
  }

  const { data: confirmed } = await supabase
    .from("findings")
    .select("*")
    .eq("check_id", checkId)
    .eq("reviewer_action", "confirmed")
    .neq("status", "match");
  if (!confirmed || confirmed.length === 0) {
    return { ok: false, message: "No confirmed findings to request corrections for." };
  }

  const usage = emptyUsage();
  try {
    const letter = await draftCorrectionLetter(
      {
        agencyName: agency.name,
        reviewerName: profile.full_name,
        label: check.label,
        policyType: check.policy_type,
        checkType: check.check_type,
        carrier: check.carrier,
        findings: confirmed as PipelineFinding[],
      },
      usage
    );

    const admin = createAdminClient();
    if (admin) {
      await admin
        .from("checks")
        .update({ correction_letter: letter })
        .eq("id", checkId);
      await admin.from("events").insert({
        agency_id: agency.id,
        user_id: profile.user_id,
        event_name: "correction_letter_generated",
        metadata: { check_id: checkId, cost_cents: Math.round(usage.costCents) },
      });
    }
    revalidatePath(`/checks/${checkId}`);
    return { ok: true, letter };
  } catch {
    return { ok: false, message: "Couldn't draft the letter. Try again." };
  }
}
