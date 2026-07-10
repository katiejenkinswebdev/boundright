import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

/** Ops console, route-guarded to the operator (ADMIN_EMAILS env, comma-separated). */
export default async function AdminPage() {
  const { user } = await requireUser();
  const adminEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (!user.email || !adminEmails.includes(user.email.toLowerCase())) notFound();

  const admin = createAdminClient();
  if (!admin) notFound();

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const [{ data: agencies }, { data: failures }, { data: costRows }] =
    await Promise.all([
      admin
        .from("agencies")
        .select("id, name, plan, billing_status, checks_this_period, created_at")
        .order("created_at", { ascending: false }),
      admin
        .from("checks")
        .select("id, agency_id, label, failure_reason, created_at")
        .eq("status", "failed")
        .order("created_at", { ascending: false })
        .limit(25),
      admin.from("checks").select("agency_id, cost_cents, created_at"),
    ]);

  const costByAgency = new Map<string, { total: number; month: number }>();
  let lastActivity = new Map<string, string>();
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
                <td className="px-4 py-3 text-ink/60">No failures. 🎉</td>
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
    </main>
  );
}
