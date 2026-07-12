// Seeds a year of realistic checks + reviewed findings into an agency so the
// dashboard, filters, and reports can be exercised at volume. Deterministic
// and repeatable: reruns first delete previously seeded rows (marked by
// doc_a_filename = 'seed_demo.pdf').
//
// Usage: set -a && source .env.local && set +a && \
//        npx tsx scripts/seed-demo-data.ts [email]
import { createClient } from "@supabase/supabase-js";

const EMAIL = process.argv[2] ?? "kind2karma@gmail.com";
const SEED_MARK = "seed_demo.pdf";
const DAY = 86_400_000;

const admin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

// Deterministic RNG (mulberry32) so reruns produce the same year.
let rngState = 20260712;
const rand = () => {
  rngState |= 0;
  rngState = (rngState + 0x6d2b79f5) | 0;
  let t = Math.imul(rngState ^ (rngState >>> 15), 1 | rngState);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rand() * arr.length)];
const int = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));
const hex = (n: number) =>
  Array.from({ length: n }, () => "0123456789abcdef"[int(0, 15)]).join("");

const CLIENTS = [
  "Acme Manufacturing", "Harbor View Restaurants", "Summit Trucking", "Blue Ridge Builders",
  "Cedar Lane Dental", "Northgate Logistics", "Prairie Wind Farms", "Ironwood Fabrication",
  "Lakeshore Hospitality", "Redline Auto Group", "Stonebridge Property Mgmt", "Golden Fields Bakery",
  "Twin Pines Landscaping", "Foundry Coffee Roasters", "Cascade Plumbing", "Meridian Medical Group",
  "Bright Path Daycare", "Overlook Wineries", "Dockside Marine Services", "Keystone Electric",
];
const CARRIERS = [
  "Midwest Casualty Insurance Company", "Granite State Mutual", "Cascade National Insurance",
  "Liberty Peak Insurance", "Heartland Assurance Group", "Pacific Crest Underwriters",
  "Fairfield General Insurance",
];
const POLICY_TYPES = ["GL", "Property", "WC", "Auto", "Umbrella", "Package"];
const SUFFIX: Record<string, string> = {
  issuance: "New Policy", renewal: "Renewal", coi: "COI Check",
};

const ISSUE_POOL = [
  { field: "General Aggregate Limit", cat: "limits", a: "$2,000,000", b: "$1,000,000", sev: "critical" },
  { field: "Each Occurrence Limit", cat: "limits", a: "$1,000,000", b: "$500,000", sev: "critical" },
  { field: "Per Claim Deductible", cat: "deductibles", a: "$2,500", b: "$5,000", sev: "critical" },
  { field: "CG 20 10 04 13 Additional Insured", cat: "forms", a: "CG 20 10 04 13", b: null, sev: "critical" },
  { field: "Expiration Date", cat: "dates", a: "01/01/2027", b: "07/01/2026", sev: "critical" },
  { field: "Named Insured", cat: "named_insured", a: "LLC", b: "Co.", sev: "critical" },
  { field: "CP 10 30 Causes of Loss (edition)", cat: "forms", a: "CP 10 30 10 12", b: "CP 10 30 06 07", sev: "moderate" },
  { field: "Total Annual Premium", cat: "premium", a: "$18,000", b: "$21,400", sev: "moderate" },
  { field: "Description of Operations", cat: "other", a: "incl. snow removal", b: "excl. snow removal", sev: "moderate" },
  { field: "Total Annual Premium", cat: "premium", a: "$14,250", b: "$14,690", sev: "minor" },
  { field: "Mailing Address Format", cat: "other", a: "Suite 200", b: "Ste 200", sev: "minor" },
] as const;
const MATCH_POOL = [
  ["Named Insured", "named_insured"], ["Effective Date", "dates"], ["Expiration Date", "dates"],
  ["Each Occurrence Limit", "limits"], ["General Aggregate Limit", "limits"],
  ["Products/Completed Ops Aggregate", "limits"], ["Medical Expense Limit", "limits"],
  ["Per Claim Deductible", "deductibles"], ["CG 00 01 04 13 Coverage Form", "forms"],
  ["IL 00 17 11 98 Common Policy Conditions", "forms"], ["Total Annual Premium", "premium"],
] as const;
const DISMISS_REASONS = ["not_a_discrepancy", "wrong_extraction", "known_intentional", "duplicate"] as const;

async function main() {
  // Locate the target agency via the user's email.
  const { data: users } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const user = users?.users.find((u) => u.email?.toLowerCase() === EMAIL.toLowerCase());
  if (!user) throw new Error(`No user with email ${EMAIL}`);
  const { data: profile } = await admin
    .from("profiles")
    .select("agency_id, user_id")
    .eq("user_id", user.id)
    .single();
  if (!profile) throw new Error(`${EMAIL} has no agency profile`);
  const agencyId = profile.agency_id;

  // Clean previous seed runs (findings cascade).
  const { count: removed } = await admin
    .from("checks")
    .delete({ count: "exact" })
    .eq("agency_id", agencyId)
    .eq("doc_a_filename", SEED_MARK);
  console.log(`removed ${removed ?? 0} previously seeded checks`);

  const now = Date.now();
  type CheckRow = Record<string, unknown>;
  const checks: CheckRow[] = [];

  for (let daysAgo = 365; daysAgo >= 1; daysAgo--) {
    const date = new Date(now - daysAgo * DAY);
    const dow = date.getUTCDay();
    if (dow === 0 || dow === 6) continue; // agencies check on weekdays
    const month = date.getUTCMonth();
    // Renewal seasons (Dec-Jan, Jun-Jul) run hotter.
    const seasonal = [1.7, 1.2, 0.8, 0.8, 0.9, 1.3, 1.6, 0.9, 0.8, 0.9, 1.1, 1.7][month];
    const todaysChecks = rand() < 0.28 * seasonal ? int(1, month === 0 || month === 11 ? 3 : 2) : 0;

    for (let i = 0; i < todaysChecks; i++) {
      const type = rand() < 0.58 ? "issuance" : rand() < 0.78 ? "renewal" : "coi";
      const policyType = pick(POLICY_TYPES);
      const client = pick(CLIENTS);
      const failed = rand() < 0.04;
      const createdAt = new Date(date.getTime() + int(13, 22) * 3_600_000 / 2);
      const recent = daysAgo <= 10;
      const status = failed
        ? "failed"
        : recent && rand() < 0.5
          ? "ready_for_review"
          : "reviewed";
      const reviewedAt =
        status === "reviewed" ? new Date(createdAt.getTime() + int(2, 60) * 3_600_000) : null;
      checks.push({
        agency_id: agencyId,
        label: `${client} ${policyType} ${SUFFIX[type]}`,
        policy_type: policyType,
        check_type: type,
        status,
        failure_reason: failed
          ? "This PDF is password-protected. Remove the password and re-upload."
          : null,
        doc_a_filename: SEED_MARK,
        doc_b_filename: "seed_demo_policy.pdf",
        carrier: failed ? null : pick(CARRIERS),
        model_version: failed ? null : "claude-sonnet-5",
        prompt_version: failed ? null : "extract_v2+compare_v1.1+verify_v1",
        tokens_in: failed ? null : int(18_000, 90_000),
        tokens_out: failed ? null : int(2_000, 9_000),
        cost_cents: failed ? null : int(9, 55),
        doc_a_sha256: failed ? null : hex(64),
        doc_b_sha256: failed ? null : hex(64),
        doc_a_pages: failed ? null : int(2, 18),
        doc_b_pages: failed ? null : int(6, 42),
        created_at: createdAt.toISOString(),
        processed_at: failed ? null : new Date(createdAt.getTime() + int(60, 150) * 1000).toISOString(),
        reviewed_at: reviewedAt?.toISOString() ?? null,
        reviewed_by: reviewedAt ? profile.user_id : null,
      });
    }
  }

  const { data: inserted, error } = await admin
    .from("checks")
    .insert(checks)
    .select("id, status, created_at, check_type");
  if (error) throw error;
  console.log(`inserted ${inserted!.length} checks`);

  // Findings for every non-failed check.
  const findings: Record<string, unknown>[] = [];
  for (const c of inserted!) {
    if (!["reviewed", "ready_for_review"].includes(c.status)) continue;
    const nMatches = int(4, 9);
    for (let i = 0; i < nMatches; i++) {
      const [field, cat] = pick(MATCH_POOL);
      findings.push({
        check_id: c.id,
        agency_id: agencyId,
        field_name: field,
        category: cat,
        status: "match",
        severity: null,
        expected_value: "$1,000,000",
        found_value: "$1,000,000",
        doc_a_page: int(1, 3),
        doc_b_page: int(1, 6),
        confidence: "high",
        created_at: c.created_at,
      });
    }
    const nIssues = rand() < 0.42 ? 0 : int(1, 3);
    for (let i = 0; i < nIssues; i++) {
      const issue = pick(ISSUE_POOL);
      const reviewedCheck = c.status === "reviewed";
      const confirmed = reviewedCheck && rand() < 0.72;
      const dismissed = reviewedCheck && !confirmed;
      findings.push({
        check_id: c.id,
        agency_id: agencyId,
        field_name: issue.field,
        category: issue.cat,
        status: issue.b === null ? "not_found_in_policy" : "mismatch",
        severity: issue.sev,
        expected_value: issue.a,
        found_value: issue.b,
        doc_a_page: int(1, 4),
        doc_b_page: issue.b === null ? null : int(1, 8),
        confidence: rand() < 0.85 ? "high" : "medium",
        doc_a_excerpt: `... ${issue.field}: ${issue.a} as proposed and bound per the schedule ...`,
        doc_b_excerpt: issue.b ? `... ${issue.field}: ${issue.b} per the issued declarations ...` : null,
        reviewer_action: confirmed ? "confirmed" : dismissed ? "dismissed" : null,
        dismiss_reason: dismissed ? pick(DISMISS_REASONS) : null,
        reviewer_note: confirmed && rand() < 0.3 ? "Verified against the dec page." : null,
        created_at: c.created_at,
      });
    }
  }

  for (let i = 0; i < findings.length; i += 500) {
    const { error: fErr } = await admin.from("findings").insert(findings.slice(i, i + 500));
    if (fErr) throw fErr;
  }
  console.log(`inserted ${findings.length} findings`);
  console.log("done: refresh the dashboard and try the range filters");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
