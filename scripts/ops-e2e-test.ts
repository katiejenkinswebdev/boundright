// End-to-end coverage of the operator features against the local database:
// provisioning (default password + forced change flag), agency lifecycle
// (decommission bans members, archive hides), the client banner column,
// the fixed monthly charge, and the allowance override feeding agencyCap.
//
// Usage: set -a && source .env.local && set +a && \
//        npx tsx scripts/ops-e2e-test.ts
import { createClient } from "@supabase/supabase-js";
import { agencyCap } from "../lib/pricing";

const admin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);
const anonClient = () =>
  createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  });

let failed = 0;
function check(name: string, ok: boolean, detail?: string) {
  console.log(`${ok ? "PASS " : "FAIL "} ${name}${!ok && detail ? ` — ${detail}` : ""}`);
  if (!ok) failed++;
}

async function main() {
  const stamp = Date.now();
  const email = `ops-e2e-${stamp}@test.local`;

  // --- Client setup shape: plan/allowance/charge/banner all stick ---
  const { data: agency, error } = await admin
    .from("agencies")
    .insert({
      name: `Ops E2E Agency ${stamp}`,
      plan: "premium",
      billing_status: "ok",
      smart_intake_enabled: true,
      checks_allowance: 500,
      custom_monthly_cents: 49_500,
      banner_message: "Ops e2e client banner",
    })
    .select("*")
    .single();
  if (error) throw error;
  check("premium client created with overrides", !!agency);
  check("allowance override feeds agencyCap", agencyCap(agency) === 500, String(agencyCap(agency)));
  check("fixed monthly charge stored (cents)", agency.custom_monthly_cents === 49_500);
  check("client banner stored", agency.banner_message === "Ops e2e client banner");

  // --- Provisioned user: default password works, forced-change flag set ---
  const { data: u, error: uErr } = await admin.auth.admin.createUser({
    email,
    password: "Default-2026!",
    email_confirm: true,
  });
  if (uErr) throw uErr;
  const { error: pErr } = await admin.from("profiles").insert({
    user_id: u.user.id,
    agency_id: agency.id,
    full_name: "Ops E2E Admin",
    role: "admin",
    must_change_password: true,
  });
  check("provisioned profile created", !pErr, pErr?.message);
  const { error: signInErr } = await anonClient().auth.signInWithPassword({
    email,
    password: "Default-2026!",
  });
  check("default password signs in", !signInErr, signInErr?.message);
  const { data: prof } = await admin
    .from("profiles")
    .select("must_change_password")
    .eq("user_id", u.user.id)
    .single();
  check("forced password change flag set", prof?.must_change_password === true);

  // --- Decommission: agency closed, member banned ---
  await admin.from("agencies").update({ closed_at: new Date().toISOString() }).eq("id", agency.id);
  await admin.auth.admin.updateUserById(u.user.id, { ban_duration: "87600h" });
  await admin.from("profiles").update({ suspended_at: new Date().toISOString() }).eq("user_id", u.user.id);
  const { error: bannedErr } = await anonClient().auth.signInWithPassword({
    email,
    password: "Default-2026!",
  });
  check("decommissioned member cannot sign in", !!bannedErr, "sign-in unexpectedly succeeded");

  // --- Reopen: access restored ---
  await admin.from("agencies").update({ closed_at: null }).eq("id", agency.id);
  await admin.auth.admin.updateUserById(u.user.id, { ban_duration: "none" });
  const { error: reopenErr } = await anonClient().auth.signInWithPassword({
    email,
    password: "Default-2026!",
  });
  check("reopened member signs in again", !reopenErr, reopenErr?.message);

  // --- Archive: hidden from the active view, present in archived ---
  await admin.from("agencies").update({ archived_at: new Date().toISOString() }).eq("id", agency.id);
  const { data: archived } = await admin
    .from("agencies")
    .select("id, archived_at")
    .eq("id", agency.id)
    .single();
  check("archive flag set", !!archived?.archived_at);
  const { data: activeList } = await admin
    .from("agencies")
    .select("id")
    .is("archived_at", null)
    .eq("id", agency.id);
  check("archived client absent from active filter", (activeList ?? []).length === 0);

  // --- Cleanup ---
  await admin.from("agencies").delete().eq("id", agency.id);
  await admin.auth.admin.deleteUser(u.user.id);

  if (failed) {
    console.error(`\n${failed} check(s) failed`);
    process.exit(1);
  }
  console.log("\nAll ops E2E checks passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
