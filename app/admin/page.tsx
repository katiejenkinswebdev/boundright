import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { isSystemAdmin } from "@/lib/roles";
import { createAdminClient } from "@/lib/supabase/admin";

/** Ops console: system_admin role (ADMIN_EMAILS env as bootstrap fallback). */
export default async function AdminPage() {
  const { user, profile } = await requireProfile();
  const adminEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const allowed =
    isSystemAdmin(profile) ||
    (!!user.email && adminEmails.includes(user.email.toLowerCase()));
  if (!allowed) notFound();

  const admin = createAdminClient();
  if (!admin) notFound();

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const [{ data: agencies }, { data: failures }, { data: costRows }, { data: feedback }, { data: driftChecks }, { data: driftFindings }] =
    await Promise.all([
      admin
        .from("agencies")
        .select("id, name, plan, billing_status, checks_this_period, created_at, manual_check_minutes, avg_account_premium, csr_hourly_rate, premium_variance_threshold, renewal_premium_threshold, reminder_hours, notify_webhook_url")
        .order("created_at", { ascending: false }),
      admin
        .from("checks")
        .select("id, agency_id, label, failure_reason, created_at")
        .eq("status", "failed")
        .order("created_at", { ascending: false })
        .limit(25),
      admin.from("checks").select("agency_id, cost_cents, created_at"),
      admin
        .from("feedback")
        .select("id, category, message, page, created_at")
        .order("created_at", { ascending: false })
        .limit(25),
      admin.from("checks").select("id, prompt_version").not("prompt_version", "is", null),
      admin
        .from("findings")
        .select("check_id, reviewer_action")
        .not("reviewer_action", "is", null)
        .neq("status", "match"),
    ]);

  // Guardrail: reviewer agreement per prompt version. A dismiss-rate spike
  // after a prompt change is the earliest regression signal; the runbook is
  // to pin the previous version (see README).
  const versionByCheck = new Map((driftChecks ?? []).map((c) => [c.id, c.prompt_version]));
  const drift = new Map<string, { confirmed: number; dismissed: number }>();
  for (const df of driftFindings ?? []) {
    const v = versionByCheck.get(df.check_id);
    if (!v) continue;
    const entry = drift.get(v) ?? { confirmed: 0, dismissed: 0 };
    if (df.reviewer_action === "confirmed") entry.confirmed++;
    else entry.dismissed++;
    drift.set(v, entry);
  }

  const costByAgency = new Map<string, { total: number; month: number }>();
  const lastActivity = new Map<string, string>();
  for (const row of costRows ?? []) {
    const entry = costByAgency.get(row.agency_id) ?? { total: 0, month: 0 };
    entry.total += row.cost_cents ?? 0;
    if (new Date(row.created_at) >= monthStart) entry.month += row.cost_cents ?? 0;
    costByAgency.set(row.agency_id, entry);
    const prev = lastActivity.get(row.agency_id);
    if (!prev || row.created_at > prev) lastActivity.set(row.agency_id, row.created_at);
  }

  const dollars = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  const overCost = (agencies ?? []).filter(
    (a) => (costByAgency.get(a.id)?.month ?? 0) > 7500
  );

  return (
    <main className="mx-auto w-full max-w-[1100px] flex-1 px-6 py-8">
      <h1 className="mb-2 text-2xl font-semibold">Ops</h1>
      <p className="mb-8 text-sm text-ink/60">
        {(agencies ?? []).length} agencies · total AI spend{" "}
        {dollars([...costByAgency.values()].reduce((s, c) => s + c.total, 0))}
      </p>

      {overCost.length > 0 && (
        <div className="mb-6 rounded border border-flag/50 bg-flag/10 p-4 text-sm">
          Cost guardrail: {overCost.map((a) => a.name).join(", ")} over $75 AI
          spend this month.
        </div>
      )}

      <section className="mb-8 overflow-x-auto rounded-lg border border-line bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left">
              <th className="px-4 py-3 font-semibold">Agency</th>
              <th className="px-4 py-3 font-semibold">Plan</th>
              <th className="px-4 py-3 font-semibold">Billing</th>
              <th className="px-4 py-3 font-semibold">Checks this period</th>
              <th className="px-4 py-3 font-semibold">AI cost (month / total)</th>
              <th className="px-4 py-3 font-semibold">Last activity</th>
            </tr>
          </thead>
          <tbody>
            {(agencies ?? []).map((a) => {
              const cost = costByAgency.get(a.id) ?? { total: 0, month: 0 };
              const last = lastActivity.get(a.id);
              return (
                <tr key={a.id} className="border-b border-line/50">
                  <td className="px-4 py-2 font-medium">{a.name}</td>
                  <td className="px-4 py-2 font-mono text-xs uppercase">{a.plan}</td>
                  <td className="px-4 py-2 font-mono text-xs">{a.billing_status}</td>
                  <td className="px-4 py-2">{a.checks_this_period}</td>
                  <td className="px-4 py-2 font-mono text-xs">
                    {dollars(cost.month)} / {dollars(cost.total)}
                  </td>
                  <td className="px-4 py-2 text-ink/60">
                    {last ? new Date(last).toLocaleDateString() : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <h2 className="mb-3 font-semibold">Recent failures</h2>
      <section className="overflow-x-auto rounded-lg border border-line bg-card">
        <table className="w-full text-sm">
          <tbody>
            {(failures ?? []).length === 0 && (
              <tr>
                <td className="px-4 py-3 text-ink/60">No failures this week.</td>
              </tr>
            )}
            {(failures ?? []).map((f) => (
              <tr key={f.id} className="border-b border-line/50">
                <td className="px-4 py-2 text-ink/60">
                  {new Date(f.created_at).toLocaleString()}
                </td>
                <td className="px-4 py-2 font-medium">{f.label}</td>
                <td className="px-4 py-2 text-ink/80">{f.failure_reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <h2 className="mb-3 mt-8 font-semibold">Client configuration (as each agency has set it)</h2>
      <section className="mb-8 overflow-x-auto rounded-lg border border-line bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left">
              <th className="px-4 py-3 font-semibold">Agency</th>
              <th className="px-4 py-3 text-right font-semibold">Check min</th>
              <th className="px-4 py-3 text-right font-semibold">Avg premium</th>
              <th className="px-4 py-3 text-right font-semibold">CSR rate</th>
              <th className="px-4 py-3 text-right font-semibold">Variance %</th>
              <th className="px-4 py-3 text-right font-semibold">Renewal %</th>
              <th className="px-4 py-3 text-right font-semibold">Reminder h</th>
              <th className="px-4 py-3 font-semibold">Slack/Teams</th>
            </tr>
          </thead>
          <tbody>
            {(agencies ?? []).map((a) => (
              <tr key={`cfg-${a.id}`} className="border-b border-line/50">
                <td className="px-4 py-2 font-medium">{a.name}</td>
                <td className="px-4 py-2 text-right font-mono">{a.manual_check_minutes}</td>
                <td className="px-4 py-2 text-right font-mono">${Number(a.avg_account_premium).toLocaleString()}</td>
                <td className="px-4 py-2 text-right font-mono">${Number(a.csr_hourly_rate)}</td>
                <td className="px-4 py-2 text-right font-mono">{Number(a.premium_variance_threshold)}</td>
                <td className="px-4 py-2 text-right font-mono">{Number(a.renewal_premium_threshold)}</td>
                <td className="px-4 py-2 text-right font-mono">{a.reminder_hours}</td>
                <td className="px-4 py-2 font-mono text-xs">{a.notify_webhook_url ? "connected" : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <h2 className="mb-3 mt-8 font-semibold">Prompt-version drift (reviewer agreement)</h2>
      <section className="mb-8 overflow-x-auto rounded-lg border border-line bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left">
              <th className="px-4 py-3 font-semibold">Prompt version</th>
              <th className="px-4 py-3 text-right font-semibold">Confirmed</th>
              <th className="px-4 py-3 text-right font-semibold">Dismissed</th>
              <th className="px-4 py-3 text-right font-semibold">Dismiss rate</th>
            </tr>
          </thead>
          <tbody>
            {[...drift.entries()].map(([version, v]) => {
              const total = v.confirmed + v.dismissed;
              const rate = total ? Math.round((v.dismissed / total) * 100) : 0;
              return (
                <tr key={version} className="border-b border-line/50">
                  <td className="px-4 py-2 font-mono text-xs">{version}</td>
                  <td className="px-4 py-2 text-right font-mono">{v.confirmed}</td>
                  <td className="px-4 py-2 text-right font-mono">{v.dismissed}</td>
                  <td className={`px-4 py-2 text-right font-mono ${rate > 40 ? "text-flag" : ""}`}>
                    {rate}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <h2 className="mb-3 mt-8 font-semibold">Recent feedback</h2>
      <section className="overflow-x-auto rounded-lg border border-line bg-card">
        <table className="w-full text-sm">
          <tbody>
            {(feedback ?? []).length === 0 && (
              <tr>
                <td className="px-4 py-3 text-ink/60">No feedback yet.</td>
              </tr>
            )}
            {(feedback ?? []).map((fb) => (
              <tr key={fb.id} className="border-b border-line/50 align-top">
                <td className="px-4 py-2 font-mono text-xs uppercase text-ink/60">{fb.category}</td>
                <td className="px-4 py-2">{fb.message}</td>
                <td className="px-4 py-2 font-mono text-xs text-ink/50">{fb.page}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
