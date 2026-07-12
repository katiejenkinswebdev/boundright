import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { isSystemAdmin } from "@/lib/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { createAnnouncement, endAnnouncement, saveLegalDoc } from "@/app/actions/admin";
import { AppShell } from "@/app/components/AppShell";
import { PageSizeSelect } from "@/app/checks/PageSizeSelect";
import { agencyCap } from "@/lib/pricing";
import { LETTER_SYSTEM } from "@/prompts/letter_v2";
import { NewClientModal } from "./NewClientModal";
import { PlatformPromptForm } from "./PlatformPromptForm";

/** Ops console: system_admin role (ADMIN_EMAILS env as bootstrap fallback). */
export default async function OpsPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; dir?: string; page?: string }>;
}) {
  const { sort = "activity", dir = "desc", page: pageParam = "1" } = await searchParams;
  const { user, profile, agency: myAgency } = await requireProfile();
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
        .select("id, name, plan, billing_status, checks_this_period, checks_allowance, created_at, smart_intake_enabled")
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
  const { data: legalTerms } = await admin
    .from("platform_config")
    .select("value")
    .eq("key", "legal_terms")
    .maybeSingle();
  const { data: legalPrivacy } = await admin
    .from("platform_config")
    .select("value")
    .eq("key", "legal_privacy")
    .maybeSingle();
  const { data: letterConfig } = await admin
    .from("platform_config")
    .select("value")
    .eq("key", "letter_prompt")
    .maybeSingle();
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

  // Sorted + paginated clients (in memory; the client list is small).
  const cookieStore = await cookies();
  const pageSize = [10, 25, 50, 100].includes(Number(cookieStore.get("br_rows")?.value))
    ? Number(cookieStore.get("br_rows")!.value)
    : 25;
  const page = Math.max(1, Number(pageParam) || 1);
  const rows = (agencies ?? []).map((a) => ({
    ...a,
    cost: costByAgency.get(a.id) ?? { total: 0, month: 0 },
    last: lastActivity.get(a.id) ?? "",
    memberCount: [...(members.get(a.id)?.values() ?? [])].reduce((x, y) => x + y, 0),
  }));
  const keyOf = (r: (typeof rows)[number]): string | number => {
    switch (sort) {
      case "name": return r.name.toLowerCase();
      case "plan": return r.plan;
      case "billing": return r.billing_status;
      case "checks": return r.checks_this_period;
      case "cost": return r.cost.month;
      case "members": return r.memberCount;
      default: return r.last;
    }
  };
  rows.sort((a, b) => {
    const [x, y] = [keyOf(a), keyOf(b)];
    const cmp = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
    return dir === "asc" ? cmp : -cmp;
  });
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const paged = rows.slice((page - 1) * pageSize, page * pageSize);
  const sortHref = (col: string) =>
    `/ops?sort=${col}&dir=${sort === col && dir === "asc" ? "desc" : "asc"}`;
  const arrow = (col: string) => (sort === col ? (dir === "asc" ? " ▲" : " ▼") : "");
  const pageHref = (p: number) => `/ops?sort=${sort}&dir=${dir}&page=${p}`;

  return (
    <AppShell agency={myAgency} profile={profile} active="/admin">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Ops console</h1>
        <NewClientModal />
      </div>
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

      <section className="mb-2 max-h-[70vh] overflow-x-auto overflow-y-auto rounded-lg border border-line bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="sticky top-0 z-10 border-b border-line bg-card text-left">
              {(
                [
                  ["name", "Agency"],
                  ["plan", "Plan"],
                  ["billing", "Billing"],
                  ["checks", "Checks (period)"],
                  ["cost", "AI cost (mo / total)"],
                  ["members", "Members"],
                  ["activity", "Last activity"],
                ] as const
              ).map(([col, label]) => (
                <th key={col} className="px-4 py-3 font-semibold">
                  <Link href={sortHref(col)} className="hover:underline">
                    {label}
                    {arrow(col)}
                  </Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.map((a) => (
              <tr key={a.id} className="border-b border-line/50 hover:bg-paper">
                <td className="px-4 py-2 font-medium">
                  <Link href={`/ops/${a.id}`} className="underline decoration-line underline-offset-2 hover:decoration-ink">
                    {a.name}
                  </Link>
                </td>
                <td className="px-4 py-2 font-mono text-xs uppercase">{a.plan}</td>
                <td className={`px-4 py-2 font-mono text-xs ${a.billing_status !== "ok" ? "text-caution" : ""}`}>
                  {a.billing_status}
                </td>
                <td className="px-4 py-2 font-mono text-xs">
                  {a.checks_this_period} / {agencyCap(a)}
                </td>
                <td className="px-4 py-2 font-mono text-xs">
                  {dollars(a.cost.month)} / {dollars(a.cost.total)}
                </td>
                <td className="px-4 py-2 text-xs text-ink/70">{memberLabel(a.id)}</td>
                <td className="px-4 py-2 text-ink/60">
                  {a.last ? new Date(a.last).toLocaleDateString() : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm">
          {page > 1 && (
            <Link href={pageHref(page - 1)} className="underline">
              ← Prev
            </Link>
          )}
          <span className="text-ink/60">
            Page {page} of {totalPages}
          </span>
          {page < totalPages && (
            <Link href={pageHref(page + 1)} className="underline">
              Next →
            </Link>
          )}
        </div>
        <PageSizeSelect value={pageSize} baseHref={`/ops?sort=${sort}&dir=${dir}`} />
      </div>

      <h2 className="mb-3 font-semibold">Platform configuration</h2>
      <section className="mb-8 rounded-lg border border-line bg-card p-6">
        <h3 className="mb-2 font-semibold">Correction request prompt (every client)</h3>
        <PlatformPromptForm value={letterConfig?.value ?? ""} builtIn={LETTER_SYSTEM} />

        <div className="mt-8 border-t border-line pt-6">
          <h3 className="mb-2 font-semibold">Legal documents</h3>
          <p className="mb-4 text-sm text-ink/70">
            Live at /terms and /privacy the moment you save. Blank fields fall
            back to the built-in documents. Plain text; blank lines separate
            paragraphs. Run substantive changes past your attorney.
          </p>
          {([
            ["legal_terms", "Terms of Service", legalTerms?.value ?? ""],
            ["legal_privacy", "Privacy Policy", legalPrivacy?.value ?? ""],
          ] as const).map(([key, label, value]) => (
            <form key={key} action={saveLegalDoc} className="mb-6 last:mb-0">
              <input type="hidden" name="doc" value={key} />
              <label className="block">
                <span className="mb-1 block text-sm font-semibold">{label}</span>
                <textarea
                  name="content"
                  defaultValue={value}
                  rows={6}
                  placeholder="Blank = the built-in document ships as is."
                  className="w-full rounded border border-line bg-paper px-3 py-2 font-mono text-xs leading-relaxed"
                />
              </label>
              <button
                type="submit"
                className="mt-2 rounded border border-ink px-4 py-1.5 text-sm font-semibold hover:bg-ink hover:text-paper"
              >
                Save {label}
              </button>
            </form>
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

      <h2 className="mb-3 mt-8 font-semibold">Recent failures</h2>
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
    </AppShell>
  );
}
