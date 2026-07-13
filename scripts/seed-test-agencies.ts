// Resets the ops console to a clean demo state: exactly three realistic
// sample clients (plus your own agency, untouched), each with an admin, a
// manager, and a user account, distinct plans/configurations, per-client
// correction-letter guidance, and a few weeks of activity. Every other
// agency (QA leftovers, old seeds) is deleted along with its logins.
//
// Usage: set -a && source .env.local && set +a && \
//        npx tsx scripts/seed-test-agencies.ts
import { createClient } from "@supabase/supabase-js";

const PASSWORD = "BoundRight-Test-2026";
const SEED_MARK = "seed_agency.pdf";
const DAY = 86_400_000;
const KEEP_AGENCY = "Minds Eye"; // your own workspace: never touched

const admin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

type Person = { first: string; last: string; email: string; role: "admin" | "manager" | "user" };

const CLIENTS: {
  name: string;
  plan: string;
  billing_status: string;
  smart_intake_enabled: boolean;
  checks_allowance: number | null;
  premium_variance_threshold: number;
  csr_hourly_rate: number;
  manual_check_minutes: number;
  reminder_hours: number;
  letter_instructions: string;
  people: Person[];
  checksBack: number;
  dailyOdds: number;
}[] = [
  {
    name: "Coastal Risk Partners",
    plan: "premium",
    billing_status: "ok",
    smart_intake_enabled: true,
    checks_allowance: 500,
    premium_variance_threshold: 3,
    csr_hourly_rate: 38,
    manual_check_minutes: 75,
    reminder_hours: 24,
    letter_instructions:
      "Reference producer code CRP-114 on every request. Address letters to the carrier's Policy Services desk, not underwriting.",
    people: [
      { first: "Cora", last: "Alvarez", email: "cora@coastalrisk.test", role: "admin" },
      { first: "Miguel", last: "Torres", email: "miguel@coastalrisk.test", role: "manager" },
      { first: "Dana", last: "Kim", email: "dana@coastalrisk.test", role: "user" },
    ],
    checksBack: 45,
    dailyOdds: 0.5,
  },
  {
    name: "Summit Insurance Group",
    plan: "founding",
    billing_status: "ok",
    smart_intake_enabled: false,
    checks_allowance: null,
    premium_variance_threshold: 5,
    csr_hourly_rate: 32,
    manual_check_minutes: 60,
    reminder_hours: 48,
    letter_instructions:
      "Close every letter with 'Summit Client Services' as the sender line. Request confirmation within 10 business days.",
    people: [
      { first: "Priya", last: "Natarajan", email: "priya@summitinsurance.test", role: "admin" },
      { first: "James", last: "Whitfield", email: "james@summitinsurance.test", role: "manager" },
      { first: "Olivia", last: "Chen", email: "olivia@summitinsurance.test", role: "user" },
    ],
    checksBack: 20,
    dailyOdds: 0.35,
  },
  {
    name: "Heartland Agency Co",
    plan: "standard",
    billing_status: "past_due",
    smart_intake_enabled: false,
    checks_allowance: null,
    premium_variance_threshold: 10,
    csr_hourly_rate: 27,
    manual_check_minutes: 50,
    reminder_hours: 72,
    letter_instructions:
      "Keep letters under 250 words; Heartland pastes them into their AMS notes. Spell out form numbers in full.",
    people: [
      { first: "Hank", last: "Odum", email: "hank@heartlandagency.test", role: "admin" },
      { first: "Grace", last: "Miller", email: "grace@heartlandagency.test", role: "manager" },
      { first: "Ben", last: "Sandoval", email: "ben@heartlandagency.test", role: "user" },
    ],
    checksBack: 30,
    dailyOdds: 0.25,
  },
];

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

const END_CLIENTS = [
  "Bayfront Charters", "Gulfside Roofing", "Pier 9 Seafood", "Tidewater Storage",
  "Alpine Outfitters", "Basecamp Breweries", "Ridge Line Realty",
  "Prairie Equipment Rental", "Cornerstone Feed & Seed", "Windmill Dairy",
];
const POLICY_TYPES = ["GL", "Property", "WC", "Auto", "Package"];

async function main() {
  // --- Purge everything except your own agency and the three clients ---
  const keepNames = new Set([...CLIENTS.map((c) => c.name)]);
  const { data: all } = await admin.from("agencies").select("id, name");
  const doomed = (all ?? []).filter(
    (a) => !a.name.startsWith(KEEP_AGENCY) && !keepNames.has(a.name)
  );
  for (const a of doomed) {
    const { data: profs } = await admin.from("profiles").select("user_id").eq("agency_id", a.id);
    await admin.from("agencies").delete().eq("id", a.id);
    for (const p of profs ?? []) {
      await admin.auth.admin.deleteUser(p.user_id).catch(() => {});
    }
  }
  console.log(`purged ${doomed.length} leftover agencies`);

  const { data: users } = await admin.auth.admin.listUsers({ perPage: 1000 });

  for (const cfg of CLIENTS) {
    const { data: existing } = await admin
      .from("agencies")
      .select("id")
      .eq("name", cfg.name)
      .maybeSingle();
    const values = {
      name: cfg.name,
      plan: cfg.plan,
      billing_status: cfg.billing_status,
      smart_intake_enabled: cfg.smart_intake_enabled,
      checks_allowance: cfg.checks_allowance,
      premium_variance_threshold: cfg.premium_variance_threshold,
      csr_hourly_rate: cfg.csr_hourly_rate,
      manual_check_minutes: cfg.manual_check_minutes,
      reminder_hours: cfg.reminder_hours,
      letter_instructions: cfg.letter_instructions,
    };
    let agencyId: string;
    if (existing) {
      agencyId = existing.id;
      await admin.from("agencies").update(values).eq("id", agencyId);
    } else {
      const { data: created, error } = await admin
        .from("agencies")
        .insert(values)
        .select("id")
        .single();
      if (error) throw error;
      agencyId = created.id;
    }

    // One account per role, real names, shared demo password, no forced
    // change (these are for your testing, not provisioning).
    let adminUserId = "";
    for (const person of cfg.people) {
      let userId = users?.users.find((u) => u.email?.toLowerCase() === person.email)?.id;
      if (!userId) {
        const { data: created, error } = await admin.auth.admin.createUser({
          email: person.email,
          password: PASSWORD,
          email_confirm: true,
        });
        if (error) throw error;
        userId = created.user.id;
      }
      const { error: pErr } = await admin.from("profiles").upsert(
        {
          user_id: userId,
          agency_id: agencyId,
          full_name: `${person.first} ${person.last}`,
          role: person.role,
          must_change_password: false,
        },
        { onConflict: "user_id" }
      );
      if (pErr) throw pErr;
      if (person.role === "admin") adminUserId = userId;
    }

    // Fresh activity window.
    await admin.from("checks").delete().eq("agency_id", agencyId).eq("doc_a_filename", SEED_MARK);
    const now = Date.now();
    const checks: Record<string, unknown>[] = [];
    for (let daysAgo = cfg.checksBack; daysAgo >= 1; daysAgo--) {
      if (rand() > cfg.dailyOdds) continue;
      const client = pick(END_CLIENTS);
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
        carrier: pick(["Granite State Mutual", "Cascade National Insurance", "Liberty Peak Insurance"]),
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
        reviewed_by: status === "reviewed" ? adminUserId : null,
      });
    }
    const { data: inserted, error: cErr } = await admin
      .from("checks")
      .insert(checks)
      .select("id, created_at, status");
    if (cErr) throw cErr;
    await admin
      .from("agencies")
      .update({
        checks_this_period: checks.filter(
          (c) => new Date(c.created_at as string).getUTCMonth() === new Date().getUTCMonth()
        ).length,
      })
      .eq("id", agencyId);

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
      `${cfg.name} (${cfg.plan}/${cfg.billing_status}, ${checks.length} checks): ${cfg.people
        .map((p) => `${p.email} [${p.role}]`)
        .join(" · ")}`
    );
  }
  console.log(`\nAll accounts use password: ${PASSWORD}`);
  console.log("done: /ops shows exactly three sample clients");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
