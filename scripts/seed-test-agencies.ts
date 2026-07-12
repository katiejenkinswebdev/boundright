// Seeds three test agencies with distinct plans, configurations, and a few
// weeks of activity so the system admin ops console shows a realistic
// multi-tenant view. Idempotent: reruns update in place.
//
// Usage: set -a && source .env.local && set +a && \
//        npx tsx scripts/seed-test-agencies.ts
import { createClient } from "@supabase/supabase-js";

const PASSWORD = "BoundRight-Test-2026";
const SEED_MARK = "seed_agency.pdf";
const DAY = 86_400_000;

const admin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const AGENCIES = [
  {
    name: "Coastal Risk Partners",
    email: "admin@coastalrisk.test",
    fullName: "Cora Coastal",
    plan: "founding",
    billing_status: "ok",
    smart_intake_enabled: true,
    premium_variance_threshold: 3,
    csr_hourly_rate: 38,
    manual_check_minutes: 75,
    reminder_hours: 24,
    checksBack: 45,
    dailyOdds: 0.5,
  },
  {
    name: "Summit Insurance Group",
    email: "admin@summitinsurance.test",
    fullName: "Sam Summit",
    plan: "trial",
    billing_status: "ok",
    smart_intake_enabled: false,
    premium_variance_threshold: 5,
    csr_hourly_rate: 32,
    manual_check_minutes: 60,
    reminder_hours: 48,
    checksBack: 10,
    dailyOdds: 0.35,
  },
  {
    name: "Heartland Agency Co",
    email: "admin@heartlandagency.test",
    fullName: "Hank Heartland",
    plan: "standard",
    billing_status: "past_due",
    smart_intake_enabled: false,
    premium_variance_threshold: 10,
    csr_hourly_rate: 27,
    manual_check_minutes: 50,
    reminder_hours: 72,
    checksBack: 30,
    dailyOdds: 0.25,
  },
] as const;

let rngState = 20260712;
const rand = () => {
  rngState |= 0;
  rngState = (rngState + 0x6d2b79f5) | 0;
  let t = Math.imul(rngState ^ (rngState >>> 15), 1 | rngState);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const int = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));
const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rand() * arr.length)];
const hex = (n: number) =>
  Array.from({ length: n }, () => "0123456789abcdef"[int(0, 15)]).join("");

const CLIENTS = [
  "Bayfront Charters", "Gulfside Roofing", "Pier 9 Seafood", "Tidewater Storage",
  "Alpine Outfitters", "Basecamp Breweries", "Ridge Line Realty",
  "Prairie Equipment Rental", "Cornerstone Feed & Seed", "Windmill Dairy",
];
const POLICY_TYPES = ["GL", "Property", "WC", "Auto", "Package"];

async function main() {
  const { data: users } = await admin.auth.admin.listUsers({ perPage: 1000 });

  for (const cfg of AGENCIES) {
    // Agency: update in place if a prior run created it.
    const { data: existing } = await admin
      .from("agencies")
      .select("id")
      .eq("name", cfg.name)
      .maybeSingle();
    const agencyValues = {
      name: cfg.name,
      plan: cfg.plan,
      billing_status: cfg.billing_status,
      smart_intake_enabled: cfg.smart_intake_enabled,
      premium_variance_threshold: cfg.premium_variance_threshold,
      csr_hourly_rate: cfg.csr_hourly_rate,
      manual_check_minutes: cfg.manual_check_minutes,
      reminder_hours: cfg.reminder_hours,
    };
    let agencyId: string;
    if (existing) {
      agencyId = existing.id;
      await admin.from("agencies").update(agencyValues).eq("id", agencyId);
    } else {
      const { data: created, error } = await admin
        .from("agencies")
        .insert(agencyValues)
        .select("id")
        .single();
      if (error) throw error;
      agencyId = created.id;
    }

    // Admin user + profile.
    let userId = users?.users.find(
      (u) => u.email?.toLowerCase() === cfg.email
    )?.id;
    if (!userId) {
      const { data: created, error } = await admin.auth.admin.createUser({
        email: cfg.email,
        password: PASSWORD,
        email_confirm: true,
      });
      if (error) throw error;
      userId = created.user.id;
    }
    await admin.from("profiles").upsert(
      {
        user_id: userId,
        agency_id: agencyId,
        full_name: cfg.fullName,
        role: "admin",
      },
      { onConflict: "user_id" }
    );

    // Activity: clean prior seeded checks, insert a fresh window.
    await admin
      .from("checks")
      .delete()
      .eq("agency_id", agencyId)
      .eq("doc_a_filename", SEED_MARK);

    const now = Date.now();
    const checks: Record<string, unknown>[] = [];
    for (let daysAgo = cfg.checksBack; daysAgo >= 1; daysAgo--) {
      if (rand() > cfg.dailyOdds) continue;
      const client = pick(CLIENTS);
      const policyType = pick(POLICY_TYPES);
      const createdAt = new Date(now - daysAgo * DAY + int(14, 21) * 3_600_000 / 2);
      const status = daysAgo <= 5 && rand() < 0.5 ? "ready_for_review" : "reviewed";
      checks.push({
        agency_id: agencyId,
        label: `${client} ${policyType} New Policy`,
        policy_type: policyType,
        check_type: "issuance",
        status,
        doc_a_filename: SEED_MARK,
        doc_b_filename: "seed_agency_policy.pdf",
        carrier: "Granite State Mutual",
        model_version: "claude-sonnet-5",
        prompt_version: "extract_v2+compare_v1.1+verify_v1",
        tokens_in: int(18_000, 70_000),
        tokens_out: int(2_000, 8_000),
        cost_cents: int(9, 48),
        doc_a_sha256: hex(64),
        doc_b_sha256: hex(64),
        doc_a_pages: int(2, 14),
        doc_b_pages: int(6, 30),
        created_at: createdAt.toISOString(),
        processed_at: new Date(createdAt.getTime() + int(60, 150) * 1000).toISOString(),
        reviewed_at:
          status === "reviewed"
            ? new Date(createdAt.getTime() + int(2, 48) * 3_600_000).toISOString()
            : null,
        reviewed_by: status === "reviewed" ? userId : null,
      });
    }
    const { data: inserted, error: cErr } = await admin
      .from("checks")
      .insert(checks)
      .select("id, created_at, status");
    if (cErr) throw cErr;
    await admin
      .from("agencies")
      .update({ checks_this_period: checks.filter((c) => new Date(c.created_at as string).getUTCMonth() === new Date().getUTCMonth()).length })
      .eq("id", agencyId);

    // A finding or two per check so drift/ratings have data.
    const findings: Record<string, unknown>[] = [];
    for (const c of inserted ?? []) {
      const reviewed = c.status === "reviewed";
      const action = reviewed ? (rand() < 0.75 ? "confirmed" : "dismissed") : null;
      findings.push({
        check_id: c.id,
        agency_id: agencyId,
        field_name: "General Aggregate Limit",
        category: "limits",
        status: "mismatch",
        severity: "critical",
        expected_value: "$2,000,000",
        found_value: "$1,000,000",
        doc_a_page: 2,
        doc_b_page: 4,
        confidence: rand() < 0.8 ? "high" : "medium",
        reviewer_action: action,
        dismiss_reason: action === "dismissed" ? "known_intentional" : null,
        created_at: c.created_at,
      });
    }
    const { error: fErr } = await admin.from("findings").insert(findings);
    if (fErr) throw fErr;

    console.log(
      `${cfg.name}: ${cfg.plan}/${cfg.billing_status}, ${checks.length} checks · login ${cfg.email} / ${PASSWORD}`
    );
  }
  console.log("done: open /admin as the system admin to see all agencies");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
