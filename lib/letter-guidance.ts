import { createAdminClient } from "@/lib/supabase/admin";

export type LetterConfig = { platformPrompt: string | null; agency: string | null };

/**
 * The two prompt layers for correction letters: the platform prompt
 * (ops-console editable; null = the built-in versioned prompt) and this
 * client's fine-tuning additions. draftCorrectionLetter combines them into
 * one system prompt.
 */
export async function getLetterGuidance(agencyId: string): Promise<LetterConfig> {
  const admin = createAdminClient();
  if (!admin) return { platformPrompt: null, agency: null };
  const [{ data: cfg }, { data: agency }] = await Promise.all([
    admin.from("platform_config").select("value").eq("key", "letter_prompt").maybeSingle(),
    admin.from("agencies").select("letter_instructions").eq("id", agencyId).maybeSingle(),
  ]);
  const clean = (v?: string | null) => (v && v.trim() ? v.trim() : null);
  return { platformPrompt: clean(cfg?.value), agency: clean(agency?.letter_instructions) };
}
