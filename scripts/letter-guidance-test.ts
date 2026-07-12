// Verifies the correction-letter guidance layers end to end against the
// local database: platform_config['letter_guidance'] and
// agencies.letter_instructions are stored, fetched by getLetterGuidance,
// and land in the drafted letter (stub mode echoes them).
//
// Usage: set -a && source .env.local && set +a && \
//        CLAUDE_STUB_DIR=eval/stubs npx tsx scripts/letter-guidance-test.ts
import { createClient } from "@supabase/supabase-js";
import { getLetterGuidance } from "../lib/letter-guidance";
import { draftCorrectionLetter, emptyUsage } from "../lib/pipeline/claude";
import type { PipelineFinding } from "../lib/pipeline/schemas";

const admin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

let failed = 0;
function check(name: string, ok: boolean, detail?: string) {
  console.log(`${ok ? "  ok " : "FAIL "} ${name}${!ok && detail ? ` — ${detail}` : ""}`);
  if (!ok) failed++;
}

async function main() {
  const stamp = Date.now();
  const GLOBAL = `TEST-PLATFORM-PROMPT-${stamp}: draft correction requests referencing the producer code.`;
  const AGENCY = `TEST-AGENCY-${stamp}: sign as Risk Management Team.`;

  // Temp agency with per-client guidance.
  const { data: agency, error } = await admin
    .from("agencies")
    .insert({ name: `Letter Guidance Test ${stamp}`, plan: "trial", letter_instructions: AGENCY })
    .select("id")
    .single();
  if (error) throw error;

  // Platform layer (restore whatever was there afterward).
  const { data: prev } = await admin
    .from("platform_config")
    .select("value")
    .eq("key", "letter_prompt")
    .maybeSingle();
  await admin.from("platform_config").upsert({ key: "letter_prompt", value: GLOBAL });

  try {
    const guidance = await getLetterGuidance(agency.id);
    check("platform prompt fetched", guidance.platformPrompt === GLOBAL, String(guidance.platformPrompt));
    check("agency guidance fetched", guidance.agency === AGENCY, String(guidance.agency));

    const finding = {
      field_name: "General Aggregate Limit",
      category: "limits",
      status: "mismatch",
      severity: "critical",
      expected_value: "$2,000,000",
      found_value: "$1,000,000",
      confidence: "high",
    } as unknown as PipelineFinding;

    const letter = await draftCorrectionLetter(
      {
        label: "Guidance Test GL New Policy",
        policyType: "GL",
        checkType: "issuance",
        carrier: "Granite State Mutual",
        findings: [finding],
        platformPrompt: guidance.platformPrompt,
        agencyGuidance: guidance.agency,
      },
      emptyUsage()
    );
    check("letter reflects the platform prompt", letter.includes("Platform prompt applied"));
    check("letter includes agency guidance", letter.includes(AGENCY));
    check("letter has no signature block", !letter.includes("Guidance Test Agency"));

    // Unset layers stay silent.
    const bare = await draftCorrectionLetter(
      {
        label: "Guidance Test GL New Policy",
        policyType: "GL",
        checkType: "issuance",
        carrier: null,
        findings: [finding],
        platformPrompt: null,
        agencyGuidance: null,
      },
      emptyUsage()
    );
    check("no layer markers when unset", !bare.includes("applied"));
  } finally {
    await admin.from("agencies").delete().eq("id", agency.id);
    await admin
      .from("platform_config")
      .upsert({ key: "letter_prompt", value: prev?.value ?? "" });
  }

  if (failed) {
    console.error(`\n${failed} check(s) failed`);
    process.exit(1);
  }
  console.log("\nletter guidance: all checks passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
