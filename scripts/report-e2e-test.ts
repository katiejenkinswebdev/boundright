// Phase 3 acceptance test: pipeline output -> reviewer confirm/dismiss under
// RLS -> mark reviewed -> branded PDF export (in-process + over HTTP).
//
// Usage: set -a && source .env.local && set +a && \
//        CLAUDE_STUB_DIR=eval/stubs npx tsx scripts/report-e2e-test.ts [appUrl]
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import { extractText, getDocumentProxy } from "unpdf";
import { runCheck, docPaths } from "../lib/pipeline/run";
import { buildReportPdf, type ReportFinding } from "../lib/report-pdf";

const URL = process.env.SUPABASE_URL!;
const ANON = process.env.SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const APP_URL = process.argv[2] ?? "";

const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

const SPECIMENS = path.join(import.meta.dirname, "..", "eval", "specimens");

async function main() {
  // --- Setup: user + agency + processed check ---
  const stampId = Date.now();
  const userClient = createClient(URL, ANON, { auth: { persistSession: false } });
  const { data: signup, error: signupErr } = await userClient.auth.signUp({
    email: `report-e2e-${stampId}@test.local`,
    password: "test-password-123",
  });
  if (signupErr || !signup.user || !signup.session) throw new Error(`signup: ${signupErr?.message}`);

  const { data: agency } = await admin
    .from("agencies")
    .insert({ name: `Report E2E Agency ${stampId}`, plan: "trial" })
    .select("id")
    .single();
  await admin.from("profiles").insert({
    user_id: signup.user.id,
    agency_id: agency!.id,
    full_name: "Rita Reviewer",
  });

  const { data: checkRow } = await admin
    .from("checks")
    .insert({ agency_id: agency!.id, label: "Acme Mfg GL Renewal", policy_type: "GL", status: "queued" })
    .select("id")
    .single();
  const checkId = checkRow!.id;
  const paths = docPaths(checkId);
  for (const [p, file] of [
    [paths.a, "pair1_proposal.pdf"],
    [paths.b, "pair1_policy.pdf"],
  ] as const) {
    await admin.storage
      .from("documents")
      .upload(p, fs.readFileSync(path.join(SPECIMENS, file)), { contentType: "application/pdf" });
  }
  await runCheck(checkId);

  // --- Review as the signed-in user (exercises RLS update policies) ---
  const { data: criticals } = await userClient
    .from("findings")
    .select("id, field_name")
    .eq("check_id", checkId)
    .eq("severity", "critical");
  check("user sees critical findings under RLS", (criticals ?? []).length === 2);

  for (const f of criticals ?? []) {
    const { data: updated } = await userClient
      .from("findings")
      .update({ reviewer_action: "confirmed", reviewer_note: "Verified against dec page." })
      .eq("id", f.id)
      .select("id");
    check(`user can confirm finding (${f.field_name.slice(0, 30)}…)`, (updated ?? []).length === 1);
  }

  const { data: minor } = await userClient
    .from("findings")
    .select("id")
    .eq("check_id", checkId)
    .eq("severity", "minor")
    .limit(1)
    .single();
  await userClient
    .from("findings")
    .update({ reviewer_action: "dismissed" })
    .eq("id", minor!.id);

  const { data: reviewedRows } = await userClient
    .from("checks")
    .update({
      status: "reviewed",
      reviewed_at: new Date().toISOString(),
      reviewed_by: signup.user.id,
    })
    .eq("id", checkId)
    .eq("status", "ready_for_review")
    .select("id");
  check("user can mark check reviewed under RLS", (reviewedRows ?? []).length === 1);

  // --- Build the export PDF in-process and inspect its text ---
  const { data: findings } = await admin
    .from("findings")
    .select("*")
    .eq("check_id", checkId)
    .order("created_at", { ascending: true });

  const { data: processedCheck } = await admin
    .from("checks")
    .select("*")
    .eq("id", checkId)
    .single();

  const pdfBytes = await buildReportPdf({
    agencyName: `Report E2E Agency ${stampId}`,
    reportId: `BR-${checkId.slice(0, 8).toUpperCase()}`,
    docA: {
      filename: "pair1_proposal.pdf",
      pages: processedCheck!.doc_a_pages,
      sha256: processedCheck!.doc_a_sha256,
    },
    docB: {
      filename: "pair1_policy.pdf",
      pages: processedCheck!.doc_b_pages,
      sha256: processedCheck!.doc_b_sha256,
    },
    receivedAt: processedCheck!.created_at,
    processedAt: processedCheck!.processed_at,
    label: "Acme Mfg GL Renewal",
    policyType: "GL",
    runDate: "July 10, 2026",
    reviewerName: "Rita Reviewer",
    reviewedDate: "July 10, 2026",
    stampDateLine: "07·10·2026",
    modelVersion: "claude-sonnet-5",
    promptVersion: "extract_v1+compare_v1+verify_v1",
    scanned: false,
    findings: (findings ?? []) as ReportFinding[],
  });

  check("PDF magic bytes", Buffer.from(pdfBytes.slice(0, 5)).toString() === "%PDF-");
  const proxy = await getDocumentProxy(new Uint8Array(pdfBytes));
  const { text } = await extractText(proxy, { mergePages: true });
  const pdfText = text as string;
  for (const [name, needle] of [
    ["agency name on report", `Report E2E Agency ${stampId}`],
    ["reviewer attribution", "reviewed by Rita Reviewer"],
    ["critical finding present", "General Aggregate"],
    ["citations present", "Document A p. 2"],
    ["audit trail present", "AUDIT TRAIL"],
    ["document fingerprints present", "SHA-256"],
    ["certification present", "the decisions recorded in this report are mine"],
    ["reconciliation line", "fields compared:"],
    ["reviewer decision recorded", "Reviewer decision: CONFIRMED"],
    ["reviewer note included", "Verified against dec page."],
    ["missing form finding", "CG 20 37"],
    ["disclaimer footer", "review assistant"],
    ["brand tagline present", "Proof it was bound right."],
    ["engine version", "claude-sonnet-5"],
    ["matches section", "MATCHED FIELDS"],
  ] as const) {
    check(name, pdfText.includes(needle), needle);
  }

  // --- Export route over HTTP with the real session cookie ---
  if (APP_URL) {
    const ref = new globalThis.URL(URL).hostname.split(".")[0];
    const session = signup.session;
    const cookieValue = `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`;
    const res = await fetch(`${APP_URL}/api/checks/${checkId}/report`, {
      headers: { cookie: `sb-${ref}-auth-token=${cookieValue}` },
    });
    check("HTTP export returns 200", res.status === 200, `status ${res.status}`);
    check(
      "HTTP export is a PDF attachment",
      (res.headers.get("content-type") ?? "").includes("application/pdf") &&
        (res.headers.get("content-disposition") ?? "").includes("BoundRight Report")
    );
    const body = Buffer.from(await res.arrayBuffer());
    check("HTTP export body is a PDF", body.subarray(0, 5).toString() === "%PDF-");

    const { data: exported } = await admin
      .from("checks")
      .select("exported_at")
      .eq("id", checkId)
      .single();
    check("exported_at recorded", !!exported?.exported_at);

    // Another agency's user must NOT be able to export this check.
    const intruder = createClient(URL, ANON, { auth: { persistSession: false } });
    const { data: intruderSignup } = await intruder.auth.signUp({
      email: `report-intruder-${stampId}@test.local`,
      password: "test-password-123",
    });
    const { data: otherAgency } = await admin
      .from("agencies")
      .insert({ name: `Intruder Agency ${stampId}`, plan: "trial" })
      .select("id")
      .single();
    await admin.from("profiles").insert({
      user_id: intruderSignup!.user!.id,
      agency_id: otherAgency!.id,
      full_name: "Intruder",
    });
    const intruderCookie = `base64-${Buffer.from(JSON.stringify(intruderSignup!.session)).toString("base64url")}`;
    const intruderRes = await fetch(`${APP_URL}/api/checks/${checkId}/report`, {
      headers: { cookie: `sb-${ref}-auth-token=${intruderCookie}` },
    });
    check("other agency cannot export the report", intruderRes.status === 404, `status ${intruderRes.status}`);
    await admin.from("agencies").delete().eq("id", otherAgency!.id);
    await admin.auth.admin.deleteUser(intruderSignup!.user!.id);
  } else {
    console.log("(skip) HTTP export test — pass app URL as argv[2]");
  }

  // Cleanup
  await admin.from("agencies").delete().eq("id", agency!.id);
  await admin.auth.admin.deleteUser(signup.user.id);

  console.log(failures === 0 ? "\nAll report E2E checks passed." : `\n${failures} FAILURES`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
