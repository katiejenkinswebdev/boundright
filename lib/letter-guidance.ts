import { createAdminClient } from "@/lib/supabase/admin";

export type LetterGuidance = { global: string | null; agency: string | null };

/**
 * The two customization layers for correction letters: the platform-wide
 * addition (ops console, one place, every client) and this agency's own
 * instructions. Both ride on top of the versioned base prompt; empty
 * strings collapse to null so the prompt stays untouched when unset.
 */
export async function getLetterGuidance(agencyId: string): Promise<LetterGuidance> {
  const admin = createAdminClient();
  if (!admin) return { global: null, agency: null };
  const [{ data: cfg }, { data: agency }] = await Promise.all([
    admin.from("platform_config").select("value").eq("key", "letter_guidance").maybeSingle(),
    admin.from("agencies").select("letter_instructions").eq("id", agencyId).maybeSingle(),
  ]);
  const clean = (v?: string | null) => (v && v.trim() ? v.trim() : null);
  return { global: clean(cfg?.value), agency: clean(agency?.letter_instructions) };
}
