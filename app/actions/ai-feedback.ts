"use server";

import { requireProfile } from "@/lib/auth";

/**
 * Records a thumbs up/down on an AI output. The prompt/model version comes
 * from the check when one is attached, so the ops console can watch
 * satisfaction per prompt version.
 */
export async function rateAiOutput(input: {
  target: "letter" | "report" | "smart_intake";
  rating: 1 | -1;
  checkId?: string;
  note?: string;
}): Promise<{ ok: boolean }> {
  const { supabase, agency, user } = await requireProfile();

  let modelVersion: string | null = null;
  let promptVersion: string | null = null;
  if (input.checkId) {
    const { data: check } = await supabase
      .from("checks")
      .select("model_version, prompt_version")
      .eq("id", input.checkId)
      .maybeSingle();
    modelVersion = check?.model_version ?? null;
    promptVersion = check?.prompt_version ?? null;
  }

  const { error } = await supabase.from("ai_feedback").insert({
    agency_id: agency.id,
    user_id: user.id,
    check_id: input.checkId ?? null,
    target: input.target,
    rating: input.rating,
    note: input.note?.slice(0, 1000) ?? null,
    model_version: modelVersion,
    prompt_version: promptVersion,
  });
  return { ok: !error };
}
