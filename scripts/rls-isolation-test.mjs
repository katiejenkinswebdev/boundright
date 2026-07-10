// Phase 1 acceptance test: two agencies must be fully isolated under RLS.
// Runs against the local Supabase stack. Usage: node scripts/rls-isolation-test.mjs
import { createClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:55321";
const ANON = process.env.SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!ANON || !SERVICE) {
  console.error("Set SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY (see .env.local)");
  process.exit(1);
}

const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });

let failures = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

async function makeUser(email, agencyName) {
  const client = createClient(URL, ANON, { auth: { persistSession: false } });
  const { data: signup, error: signupErr } = await client.auth.signUp({
    email,
    password: "test-password-123",
    options: { data: { full_name: `Owner of ${agencyName}` } },
  });
  if (signupErr) throw new Error(`signup ${email}: ${signupErr.message}`);
  const user = signup.user;

  // Mirror the onboarding server action (service role creates agency+profile).
  const { data: agency, error: agencyErr } = await admin
    .from("agencies")
    .insert({ name: agencyName, plan: "trial" })
    .select("id")
    .single();
  if (agencyErr) throw new Error(`agency ${agencyName}: ${agencyErr.message}`);
  const { error: profErr } = await admin.from("profiles").insert({
    user_id: user.id,
    agency_id: agency.id,
    full_name: `Owner of ${agencyName}`,
  });
  if (profErr) throw new Error(`profile ${email}: ${profErr.message}`);
  return { client, user, agencyId: agency.id };
}

const stamp = Date.now();
const A = await makeUser(`rls-a-${stamp}@test.local`, `Agency A ${stamp}`);
const B = await makeUser(`rls-b-${stamp}@test.local`, `Agency B ${stamp}`);

// A creates a check through the normal user client (exercises insert policy).
const { data: aCheck, error: aCheckErr } = await A.client
  .from("checks")
  .insert({ agency_id: A.agencyId, label: "Acme Mfg GL Renewal", policy_type: "GL" })
  .select("id")
  .single();
check("A can insert a check in own agency", !aCheckErr && !!aCheck, aCheckErr?.message);

const { data: aFinding, error: aFindErr } = await A.client
  .from("findings")
  .insert({
    check_id: aCheck.id,
    agency_id: A.agencyId,
    field_name: "General Aggregate Limit",
    category: "limits",
    status: "mismatch",
    severity: "critical",
    expected_value: "$2,000,000",
    found_value: "$1,000,000",
  })
  .select("id")
  .single();
check("A can insert a finding in own agency", !aFindErr && !!aFinding, aFindErr?.message);

// --- Isolation: everything B tries against A must come back empty or fail ---

const { data: bAgencies } = await B.client.from("agencies").select("id");
check(
  "B sees exactly one agency (their own)",
  bAgencies?.length === 1 && bAgencies[0].id === B.agencyId,
  `saw ${bAgencies?.length}`
);

const { data: bReadA } = await B.client.from("agencies").select("*").eq("id", A.agencyId);
check("B cannot read agency A by id", bReadA?.length === 0);

const { data: bChecks } = await B.client.from("checks").select("*").eq("agency_id", A.agencyId);
check("B cannot read A's checks", bChecks?.length === 0);

const { data: bFindings } = await B.client.from("findings").select("*").eq("agency_id", A.agencyId);
check("B cannot read A's findings", bFindings?.length === 0);

const { data: bProfiles } = await B.client.from("profiles").select("*").eq("agency_id", A.agencyId);
check("B cannot read A's profiles", bProfiles?.length === 0);

const { error: bInsertErr } = await B.client
  .from("checks")
  .insert({ agency_id: A.agencyId, label: "sneaky", policy_type: "GL" });
check("B cannot insert a check into agency A", !!bInsertErr, bInsertErr?.message ?? "insert succeeded!");

const { data: bUpdate } = await B.client
  .from("agencies")
  .update({ name: "hijacked" })
  .eq("id", A.agencyId)
  .select();
check("B cannot update agency A", bUpdate?.length === 0);

const { data: bDelete } = await B.client
  .from("checks")
  .delete()
  .eq("agency_id", A.agencyId)
  .select();
check("B cannot delete A's checks", bDelete?.length === 0);

const { data: bReviewA } = await B.client
  .from("findings")
  .update({ reviewer_action: "confirmed" })
  .eq("id", aFinding.id)
  .select();
check("B cannot review A's findings", bReviewA?.length === 0);

// Unauthenticated client sees nothing at all.
const anonClient = createClient(URL, ANON, { auth: { persistSession: false } });
const { data: anonAgencies } = await anonClient.from("agencies").select("*");
check("anonymous sees no agencies", (anonAgencies ?? []).length === 0);
const { data: anonSignups, error: anonSignupErr } = await anonClient
  .from("email_signups")
  .select("*");
check(
  "anonymous cannot read email_signups",
  !!anonSignupErr || (anonSignups ?? []).length === 0
);

// A still sees their own world intact.
const { data: aOwn } = await A.client.from("checks").select("id");
check("A still sees own check", aOwn?.length === 1);

// Cleanup
await admin.from("agencies").delete().in("id", [A.agencyId, B.agencyId]);
await admin.auth.admin.deleteUser(A.user.id);
await admin.auth.admin.deleteUser(B.user.id);

console.log(failures === 0 ? "\nAll RLS isolation checks passed." : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
