import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { isSystemAdmin } from "@/lib/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { toggleSmartIntake, createAnnouncement, endAnnouncement, saveGlobalLetterGuidance, saveAgencyLetterGuidance } from "@/app/actions/admin";

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

  const [{ data: agencies }, { data: failures }, { data: costRows }, { data: feedback }, { data: driftChecks }, { data: driftFindings }, { data: memberRows }] =
    await Promise.all([
      admin
        .from("agencies")
        .select("id, name, plan, billing_status, checks_this_period, created_at, manual_check_minutes, avg_account_premium, csr_hourly_rate, premium_variance_threshold, renewal_premium_threshold, reminder_hours, notify_webhook_url, smart_intake_enabled")
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
      admin.from("profiles").select("agency_id, role"),
    ]);

  const { data: aiRatings } = await admin
    .from("ai_feedback")
    .select("target, prompt_version, rating");
  const { data: letterConfig } = await admin
    .from("platform_config")
    .select("value")
    .eq("key", "letter_guidance")
    .maybeSingle();
  const { data: agencyGuidance } = await admin
    .from("agencies")
    .select("id, name, letter_instructions")
    .order("name");
  const { data: announcements } = await admin
    .from("announcements")
    .select("id, message, link_url, starts_at, ends_at")
    .gt("ends_at", new Date().toISOString())
    .order("starts_at", { ascending: true });

  // Members per agency, e.g. "1 admin · 2 user".
  const members = new Map<string, Map<string, number>>();
  for (const m of memberRows ?? []) {
    const byRole = members.get(m.agency_id) ?? new Map<string, number>();
    byRole.set(m.role, (byRole.get(m.role) ?? 0) + 1);
    members.set(m.agency_id, byRole);
  }
  const memberLabel = (agencyId: string) => {
    const byRole = members.get(agencyId);
    if (!byRole) return "—";
    return ["system_admin", "admin", "manager", "user"]
      .filter((r) => byRole.has(r))
      .map((r) => `${byRole.get(r)} ${r.replace("system_admin", "sys admin")}`)
      .join(" · ");
  };

  // Thumb ratings per AI surface + prompt version.
  const ratings = new Map<string, { up: number; down: number }>();
  for (const r of aiRatings ?? []) {
    const key = `${r.target} · ${r.prompt_version ?? "unversioned"}`;
    const entry = ratings.get(key) ?? { up: 0, down: 0 };
    if (r.rating > 0) entry.up++;
    else entry.down++;
    ratings.set(key, entry);
  }

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
              <th className="px-4 py-3 font-semibold">Since</th>
              <th className="px-4 py-3 font-semibold">Members</th>
              <th className="px-4 py-3 text-right font-semibold">Check min</th>
              <th className="px-4 py-3 text-right font-semibold">Avg premium</th>
              <th className="px-4 py-3 text-right font-semibold">CSR rate</th>
              <th className="px-4 py-3 text-right font-semibold">Variance %</th>
              <th className="px-4 py-3 text-right font-semibold">Renewal %</th>
              <th className="px-4 py-3 text-right font-semibold">Reminder h</th>
              <th className="px-4 py-3 font-semibold">Slack/Teams</th>
              <th className="px-4 py-3 font-semibold">Smart intake</th>
              <th className="px-4 py-3 font-semibold">Audit</th>
            </tr>
          </thead>
          <tbody>
            {(agencies ?? []).map((a) => (
              <tr key={`cfg-${a.id}`} className="border-b border-line/50">
                <td className="px-4 py-2 font-medium">{a.name}</td>
                <td className="px-4 py-2 text-ink/60">
                  {new Date(a.created_at).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                </td>
                <td className="px-4 py-2 text-xs text-ink/70">{memberLabel(a.id)}</td>
                <td className="px-4 py-2 text-right font-mono">{a.manual_check_minutes}</td>
                <td className="px-4 py-2 text-right font-mono">${Number(a.avg_account_premium).toLocaleString()}</td>
                <td className="px-4 py-2 text-right font-mono">${Number(a.csr_hourly_rate)}</td>
                <td className="px-4 py-2 text-right font-mono">{Number(a.premium_variance_threshold)}</td>
                <td className="px-4 py-2 text-right font-mono">{Number(a.renewal_premium_threshold)}</td>
                <td className="px-4 py-2 text-right font-mono">{a.reminder_hours}</td>
                <td className="px-4 py-2 font-mono text-xs">{a.notify_webhook_url ? "connected" : "—"}</td>
                <td className="px-4 py-2">
                  <form
                    action={async () => {
                      "use server";
                      await toggleSmartIntake(a.id, !a.smart_intake_enabled);
                    }}
                  >
                    <button
                      type="submit"
                      className={`inline-flex items-center rounded border px-2.5 py-1 font-mono text-xs leading-none ${
                        a.smart_intake_enabled
                          ? "border-verify text-verify"
                          : "border-line text-ink/50 hover:border-ink"
                      }`}
                    >
                      {a.smart_intake_enabled ? "on" : "off"}
                    </button>
                  </form>
                </td>
                <td className="px-4 py-2">
                  <a href={`/api/admin/audit/${a.id}`} className="text-sm underline">
                    Audit log (CSV)
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <h2 className="mb-3 mt-8 font-semibold">Correction letter prompt</h2>
      <section className="mb-8 rounded-lg border border-line bg-card p-6">
        <p className="mb-4 text-sm text-ink/70">
          Letters are drafted from the versioned base prompt (letter_v2, in
          the repo). The guidance below layers on top without touching it:
          the platform layer applies to every client, a client&apos;s own
          layer applies only to them and wins where they conflict.
        </p>
        <form action={saveGlobalLetterGuidance} className="mb-6">
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">
              Platform-wide guidance (all clients, one place)
            </span>
            <textarea
              name="guidance"
              defaultValue={letterConfig?.value ?? ""}
              rows={3}
              maxLength={4000}
              placeholder="Example: Always reference the producer code when known. Close with 'We appreciate your prompt attention.'"
              className="w-full rounded border border-line bg-paper px-3 py-2 font-mono text-sm"
            />
          </label>
          <button
            type="submit"
            className="mt-2 rounded bg-ink px-4 py-2 text-sm font-semibold text-paper hover:bg-ink/90"
          >
            Save platform guidance
          </button>
        </form>

        <p className="mb-2 text-sm font-semibold">Per-client guidance</p>
        <div className="space-y-2">
          {(agencyGuidance ?? []).map((ag) => (
            <details key={ag.id} className="rounded border border-line p-3">
              <summary className="cursor-pointer text-sm">
                <span className="font-medium">{ag.name}</span>
                <span className="ml-2 font-mono text-xs text-ink/50">
                  {ag.letter_instructions ? "customized" : "default"}
                </span>
              </summary>
              <form
                action={async (formData: FormData) => {
                  "use server";
                  await saveAgencyLetterGuidance(ag.id, formData);
                }}
                className="mt-3"
              >
                <textarea
                  name="guidance"
                  defaultValue={ag.letter_instructions ?? ""}
                  rows={3}
                  maxLength={4000}
                  placeholder="Example: This agency signs as 'Risk Management Team'. Reference their carrier service center, not underwriting."
                  className="w-full rounded border border-line bg-paper px-3 py-2 font-mono text-sm"
                />
                <button
                  type="submit"
                  className="mt-2 rounded border border-ink px-4 py-1.5 text-sm font-semibold hover:bg-ink hover:text-paper"
                >
                  Save for this client
                </button>
                <span className="ml-3 text-xs text-ink/50">Clear the box and save to return to default.</span>
              </form>
            </details>
          ))}
        </div>
      </section>

      <h2 className="mb-3 mt-8 font-semibold">Announcements (banner across the app)</h2>
      <section className="mb-8 rounded-lg border border-line bg-card p-6">
        <form action={createAnnouncement} className="grid gap-3 sm:grid-cols-2">
          <label className="sm:col-span-2 block">
            <span className="mb-1 block text-sm font-semibold">Message</span>
            <input
              name="message"
              required
              maxLength={300}
              placeholder="Scheduled maintenance Saturday 6-7am ET. Checks queue and run afterward."
              className="w-full rounded border border-line bg-paper px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Shows from</span>
            <input
              name="starts_at"
              type="datetime-local"
              className="w-full rounded border border-line bg-paper px-3 py-2 text-sm"
            />
            <span className="mt-1 block text-xs text-ink/50">Blank = now</span>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Hides after</span>
            <input
              name="ends_at"
              type="datetime-local"
              required
              className="w-full rounded border border-line bg-paper px-3 py-2 text-sm"
            />
          </label>
          <label className="sm:col-span-2 block">
            <span className="mb-1 block text-sm font-semibold">Link (optional)</span>
            <input
              name="link_url"
              type="url"
              placeholder="https://…"
              className="w-full rounded border border-line bg-paper px-3 py-2 text-sm"
            />
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="rounded bg-ink px-4 py-2 text-sm font-semibold text-paper hover:bg-ink/90"
            >
              Post announcement
            </button>
            <span className="ml-3 text-xs text-ink/50">
              The banner appears and disappears on these dates by itself.
            </span>
          </div>
        </form>

        {(announcements ?? []).length > 0 && (
          <table className="mt-6 w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left">
                <th className="py-2 font-semibold">Message</th>
                <th className="py-2 font-semibold">Window</th>
                <th className="py-2 font-semibold">Status</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {(announcements ?? []).map((an) => {
                const live =
                  new Date(an.starts_at) <= new Date() && new Date(an.ends_at) > new Date();
                return (
                  <tr key={an.id} className="border-b border-line/50 align-top">
                    <td className="py-2 pr-4">{an.message}</td>
                    <td className="py-2 pr-4 font-mono text-xs text-ink/60">
                      {new Date(an.starts_at).toLocaleString()} → {new Date(an.ends_at).toLocaleString()}
                    </td>
                    <td className="py-2 pr-4 font-mono text-xs">
                      {live ? <span className="text-verify">live</span> : "scheduled"}
                    </td>
                    <td className="py-2 text-right">
                      <form
                        action={async () => {
                          "use server";
                          await endAnnouncement(an.id);
                        }}
                      >
                        <button type="submit" className="text-sm underline">
                          End now
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
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

      <h2 className="mb-3 mt-8 font-semibold">AI output ratings (thumbs, by surface + prompt version)</h2>
      <section className="mb-8 overflow-x-auto rounded-lg border border-line bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left">
              <th className="px-4 py-3 font-semibold">Surface · prompt version</th>
              <th className="px-4 py-3 text-right font-semibold">Up</th>
              <th className="px-4 py-3 text-right font-semibold">Down</th>
              <th className="px-4 py-3 text-right font-semibold">Down rate</th>
            </tr>
          </thead>
          <tbody>
            {ratings.size === 0 && (
              <tr>
                <td className="px-4 py-3 text-ink/60" colSpan={4}>
                  No ratings yet. Thumbs appear on the correction letter, smart
                  intake, and report screens.
                </td>
              </tr>
            )}
            {[...ratings.entries()].map(([key, v]) => {
              const total = v.up + v.down;
              const rate = total ? Math.round((v.down / total) * 100) : 0;
              return (
                <tr key={key} className="border-b border-line/50">
                  <td className="px-4 py-2 font-mono text-xs">{key}</td>
                  <td className="px-4 py-2 text-right font-mono">{v.up}</td>
                  <td className="px-4 py-2 text-right font-mono">{v.down}</td>
                  <td className={`px-4 py-2 text-right font-mono ${rate > 40 && total >= 5 ? "text-flag" : ""}`}>
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
