// Phase 2 acceptance test: exercises the real pipeline end to end against
// local Supabase — upload to storage, runCheck() orchestration, findings
// persisted, PDFs verifiably deleted, cap incremented — plus the failure
// paths (password-protected PDF, non-PDF) with the exact spec copy.
//
// Claude calls are stubbed (CLAUDE_STUB_DIR) so this runs without an API key;
// eval/run.ts does the live-model scoring.
//
// Usage: set -a && source .env.local && set +a && \
//        CLAUDE_STUB_DIR=eval/stubs npx tsx scripts/pipeline-e2e-test.ts
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import { runCheck, docPaths } from "../lib/pipeline/run";

const URL = process.env.SUPABASE_URL!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!URL || !SERVICE || !process.env.CLAUDE_STUB_DIR) {
  console.error("Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CLAUDE_STUB_DIR");
  process.exit(1);
}

const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

const SPECIMENS = path.join(import.meta.dirname, "..", "eval", "specimens");

async function setupAgency(): Promise<string> {
  const { data: agency, error } = await admin
    .from("agencies")
    .insert({ name: `Pipeline E2E ${Date.now()}`, plan: "trial" })
    .select("id")
    .single();
  if (error || !agency) throw new Error(`agency setup: ${error?.message}`);
  return agency.id;
}

async function createCheckWithDocs(
  agencyId: string,
  label: string,
  docA: Buffer,
  docB: Buffer
): Promise<string> {
  const { data: checkRow, error } = await admin
    .from("checks")
    .insert({ agency_id: agencyId, label, policy_type: "GL", status: "queued" })
    .select("id")
    .single();
  if (error || !checkRow) throw new Error(`check setup: ${error?.message}`);
  const paths = docPaths(checkRow.id);
  for (const [p, buf] of [
    [paths.a, docA],
    [paths.b, docB],
  ] as const) {
    // Same path the browser takes: signed upload URL, then PUT.
    const { data: signed, error: signErr } = await admin.storage
      .from("documents")
      .createSignedUploadUrl(p);
    if (signErr || !signed) throw new Error(`sign: ${signErr?.message}`);
    const res = await fetch(signed.signedUrl, {
      method: "PUT",
      headers: { "Content-Type": "application/pdf" },
      body: new Uint8Array(buf),
    });
    if (!res.ok) throw new Error(`upload failed: ${res.status}`);
  }
  return checkRow.id;
}

async function getCheck(id: string) {
  const { data } = await admin.from("checks").select("*").eq("id", id).single();
  return data!;
}

async function filesRemaining(checkId: string): Promise<number> {
  const { data } = await admin.storage.from("documents").list(`checks/${checkId}`);
  return data?.length ?? 0;
}

async function main() {
const agencyId = await setupAgency();

// ---------------------------------------------------------------------------
// Happy path: pair 1 specimen (stubbed extraction + comparison)
// ---------------------------------------------------------------------------
const proposal = fs.readFileSync(path.join(SPECIMENS, "pair1_proposal.pdf"));
const policy = fs.readFileSync(path.join(SPECIMENS, "pair1_policy.pdf"));
const happyId = await createCheckWithDocs(agencyId, "Acme Mfg GL Renewal", proposal, policy);

await runCheck(happyId);

const happy = await getCheck(happyId);
check("check reaches ready_for_review", happy.status === "ready_for_review", happy.status);
check("model version recorded", happy.model_version === "claude-sonnet-5", happy.model_version);
check("prompt version recorded", !!happy.prompt_version, happy.prompt_version);

const { data: findings } = await admin
  .from("findings")
  .select("*")
  .eq("check_id", happyId);
const criticals = (findings ?? []).filter((f) => f.severity === "critical");
const matches = (findings ?? []).filter((f) => f.status === "match");
check("findings persisted", (findings ?? []).length === 8, `${findings?.length}`);
check(
  "both seeded criticals present",
  criticals.length === 2 &&
    criticals.some((f) => f.field_name.includes("General Aggregate")) &&
    criticals.some((f) => f.field_name.includes("CG 20 37")),
  criticals.map((f) => f.field_name).join("; ")
);
check("matches persisted too", matches.length === 5, `${matches.length}`);
check("PDFs deleted after success", (await filesRemaining(happyId)) === 0);

const { data: agencyRow } = await admin
  .from("agencies")
  .select("checks_this_period")
  .eq("id", agencyId)
  .single();
check("cap incremented on success", agencyRow?.checks_this_period === 1);

// ---------------------------------------------------------------------------
// Failure path: password-protected PDF
// ---------------------------------------------------------------------------
const encrypted = fs.readFileSync(path.join(SPECIMENS, "encrypted.pdf"));
const pwId = await createCheckWithDocs(agencyId, "Password test", encrypted, policy);
await runCheck(pwId);
const pw = await getCheck(pwId);
check("password-protected PDF fails", pw.status === "failed", pw.status);
check(
  "password failure copy matches spec",
  pw.failure_reason === "This PDF is password-protected. Remove the password and re-upload.",
  pw.failure_reason
);
check("PDFs deleted after failure", (await filesRemaining(pwId)) === 0);

// ---------------------------------------------------------------------------
// Failure path: not a PDF (a .docx-shaped file that slipped past the client)
// ---------------------------------------------------------------------------
const fakeDocx = Buffer.from("PK\x03\x04 not really a pdf at all");
const docxId = await createCheckWithDocs(agencyId, "Docx test", fakeDocx, policy);
await runCheck(docxId);
const docx = await getCheck(docxId);
check("non-PDF fails", docx.status === "failed", docx.status);
check(
  "non-PDF failure copy is directive",
  (docx.failure_reason ?? "").includes("Export it as PDF and try again"),
  docx.failure_reason
);

// ---------------------------------------------------------------------------
// Failure path: a non-insurance document (email printed to PDF)
// ---------------------------------------------------------------------------
const trashEmail = fs.readFileSync(path.join(SPECIMENS, "trash_email.pdf"));
const trashId = await createCheckWithDocs(agencyId, "Trash email test", trashEmail, policy);
await runCheck(trashId);
const trash = await getCheck(trashId);
check("email-as-PDF fails the quality gate", trash.status === "failed", trash.status);
check(
  "trash failure copy names the problem and the fix",
  (trash.failure_reason ?? "").includes("doesn't look like an insurance document"),
  trash.failure_reason
);

// ---------------------------------------------------------------------------
// Failure path: the same file uploaded twice
// ---------------------------------------------------------------------------
const dupId = await createCheckWithDocs(agencyId, "Duplicate file test", policy, policy);
await runCheck(dupId);
const dup = await getCheck(dupId);
check("identical uploads fail", dup.status === "failed", dup.status);
check(
  "identical-files copy is directive",
  (dup.failure_reason ?? "").includes("Both uploads are the same file"),
  dup.failure_reason
);

// Failed checks must not count against the cap.
const { data: agencyAfter } = await admin
  .from("agencies")
  .select("checks_this_period")
  .eq("id", agencyId)
  .single();
check("failed checks don't count against cap", agencyAfter?.checks_this_period === 1);

// Cleanup
await admin.from("agencies").delete().eq("id", agencyId);

console.log(failures === 0 ? "\nAll pipeline E2E checks passed." : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
