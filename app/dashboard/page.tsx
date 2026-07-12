import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { getDashboardStats } from "@/lib/stats";
import { canSeeAnalytics } from "@/lib/roles";
import { AppShell } from "@/app/components/AppShell";
import { TrendChart } from "@/app/components/TrendChart";
import { MonthlyReportButton } from "./MonthlyReportButton";
import { SampleCheckButton } from "./SampleCheckButton";
import { InfoTip } from "@/app/components/InfoTip";

const STATUS_LABEL: Record<string, string> = {
  queued: "Queued",
  extracting: "Reading documents",
  comparing: "Comparing",
  ready_for_review: "Ready for review",
  reviewed: "Reviewed",
  failed: "Failed",
};

function RecentOnly({ stats }: { stats: Awaited<ReturnType<typeof getDashboardStats>> }) {
  return (
    <section className="rounded-lg border border-line bg-card p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold">Recent checks</h2>
        <Link href="/checks" className="text-sm underline">
          View all
        </Link>
      </div>
      <ul className="divide-y divide-line/60">
        {stats.recent.map((c) => (
          <li key={c.id}>
            <Link
              href={`/checks/${c.id}`}
              className="flex items-center justify-between gap-4 py-3 hover:bg-paper"
            >
              <span className="min-w-0 flex-1 truncate font-medium">{c.label}</span>
              <span className="font-mono text-xs uppercase tracking-wide text-ink/60">
                {STATUS_LABEL[c.status] ?? c.status}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-sm text-ink/50">
        Agency analytics are available to managers and admins.
      </p>
    </section>
  );
}

export default async function DashboardPage() {
  const { supabase, profile, agency } = await requireProfile();
  const stats = await getDashboardStats(supabase, agency);
  const hasAnyChecks = stats.recent.length > 0;
  const analytics = canSeeAnalytics(profile);

  // Per-carrier error rates (managers and admins only).
  let carrierRows: { carrier: string; checks: number; criticals: number }[] = [];
  if (analytics) {
    const { data: carrierChecks } = await supabase
      .from("checks")
      .select("id, carrier")
      .not("carrier", "is", null)
      .in("status", ["ready_for_review", "reviewed"]);
    const { data: confirmedCriticals } = await supabase
      .from("findings")
      .select("check_id")
      .eq("reviewer_action", "confirmed")
      .eq("severity", "critical");
    const criticalByCheck = new Map<string, number>();
    for (const fc of confirmedCriticals ?? []) {
      criticalByCheck.set(fc.check_id, (criticalByCheck.get(fc.check_id) ?? 0) + 1);
    }
    const byCarrier = new Map<string, { checks: number; criticals: number }>();
    for (const c of carrierChecks ?? []) {
      const entry = byCarrier.get(c.carrier) ?? { checks: 0, criticals: 0 };
      entry.checks++;
      entry.criticals += criticalByCheck.get(c.id) ?? 0;
      byCarrier.set(c.carrier, entry);
    }
    carrierRows = [...byCarrier.entries()]
      .map(([carrier, v]) => ({ carrier, ...v }))
      .sort((a, b) => b.criticals - a.criticals)
      .slice(0, 10);
  }

  return (
    <AppShell agency={agency} profile={profile} active="/dashboard">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-ink/60">{agency.name}</p>
        </div>
        {analytics && <MonthlyReportButton />}
      </div>

      {!hasAnyChecks ? (
        <section className="flex flex-col items-center rounded-lg border border-line bg-card px-8 py-20 text-center">
          <h2 className="text-2xl font-semibold">
            Run a sample check to see your dashboard come alive.
          </h2>
          <p className="mt-3 max-w-md text-ink/70">
            We&apos;ll compare a specimen proposal against its issued policy,
            two seeded errors included, so you can see exactly what a
            BoundRight report looks like. Nothing of yours is uploaded.
          </p>
          <div className="mt-8">
            <SampleCheckButton />
          </div>
          <Link href="/checks/new" className="mt-4 text-sm underline">
            Or run your first real check
          </Link>
        </section>
      ) : !analytics ? (
        <RecentOnly stats={stats} />
      ) : (
        <>
          {/* KPI row */}
          <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-line bg-card p-5">
              <p className="text-sm text-ink/60">Checks this month</p>
              <p className="mt-1 text-3xl font-semibold">
                {stats.checksThisPeriod}
                <span className="text-base font-normal text-ink/50"> of {stats.cap}</span>
              </p>
              {/* cap meter: same-ramp track */}
              <div className="mt-3 h-2 w-full rounded-full" style={{ background: "#D6E0F0" }}>
                <div
                  className="h-2 rounded-full"
                  style={{
                    width: `${Math.min(100, (stats.checksThisPeriod / stats.cap) * 100)}%`,
                    background: "#2E5A9E",
                  }}
                />
              </div>
              {stats.checksThisPeriod / stats.cap >= 0.8 && stats.checksThisPeriod < stats.cap && (
                <p className="mt-2 text-xs text-ink/60">
                  Approaching this period&apos;s limit.
                </p>
              )}
            </div>

            <div className="rounded-lg border border-line bg-card p-5">
              <p className="text-sm text-ink/60">
                Confirmed discrepancies
                <InfoTip label="What counts as confirmed">
                  Only findings a reviewer explicitly confirmed. Dismissed findings
                  and unreviewed reports never count toward your numbers, so these
                  totals are your team&apos;s judgment, not the AI&apos;s.
                </InfoTip>
              </p>
              <p className="mt-1 text-3xl font-semibold">{stats.confirmedTotal}</p>
              <p className="mt-3 text-xs text-ink/60">
                <span className="text-flag">{stats.confirmedBySeverity.critical} critical</span>
                {" · "}
                <span className="text-caution">{stats.confirmedBySeverity.moderate} moderate</span>
                {" · "}
                {stats.confirmedBySeverity.minor} minor
              </p>
            </div>

            <div className="rounded-lg border border-line bg-card p-5">
              <p className="text-sm text-ink/60">
                Hours saved
                <InfoTip label="How hours saved is calculated">
                  {stats.trend.reduce((s, p) => s + p.checks, 0)} completed checks
                  in the last 6 months, at {agency.manual_check_minutes} minutes of
                  manual review each, comes to {stats.hoursSaved.toFixed(1)} hours.
                  At a ${Number(agency.csr_hourly_rate)}/hr loaded CSR rate that is
                  about ${Math.round(stats.hoursSaved * Number(agency.csr_hourly_rate)).toLocaleString()}
                  {" "}in staff time.
                </InfoTip>
              </p>
              <p className="mt-1 text-3xl font-semibold">{stats.hoursSaved.toFixed(1)}</p>
              <p className="mt-3 text-xs text-ink/60">
                ≈ ${Math.round(stats.hoursSaved * Number(agency.csr_hourly_rate)).toLocaleString()} in staff time.
              </p>
            </div>

            <div className="rounded-lg border border-line bg-card p-5">
              <p className="text-sm text-ink/60">
                Exposure flagged
                <InfoTip label="How exposure flagged is calculated">
                  {stats.confirmedBySeverity.critical} confirmed critical findings ×
                  your ${Number(agency.avg_account_premium).toLocaleString()} average
                  account premium. An estimate of premium at risk, not a promise of
                  avoided claims. Only findings a licensed reviewer confirmed count.
                </InfoTip>
              </p>
              <p className="mt-1 text-3xl font-semibold text-verify">
                ${stats.exposureFlagged.toLocaleString()}
              </p>
              <p className="mt-3 text-xs text-ink/60">
                An estimate based on your average account premium ($
                {Number(agency.avg_account_premium).toLocaleString()}).
              </p>
            </div>
          </section>

          {/* Trend */}
          <section className="mb-8 rounded-lg border border-line bg-card p-6">
            <h2 className="mb-4 font-semibold">Last 6 months</h2>
            <TrendChart trend={stats.trend} />
          </section>

          {carrierRows.length > 0 && (
            <section className="mb-8 rounded-lg border border-line bg-card p-6">
              <h2 className="mb-1 font-semibold">
                Carrier issuance accuracy
                <InfoTip label="How carrier accuracy is measured">
                  Carrier names are read from the issued policies. Criticals are
                  counted only after your reviewer confirms them. Small sample
                  sizes mislead: treat under 10 checks per carrier as anecdote.
                </InfoTip>
              </h2>
              <p className="mb-4 text-sm text-ink/60">
                Confirmed critical findings by issuing carrier. Where the
                corrections keep going.
              </p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left">
                    <th className="py-2 font-semibold">Carrier</th>
                    <th className="py-2 text-right font-semibold">Checks</th>
                    <th className="py-2 text-right font-semibold">Confirmed criticals</th>
                  </tr>
                </thead>
                <tbody>
                  {carrierRows.map((r) => (
                    <tr key={r.carrier} className="border-b border-line/50">
                      <td className="py-2">{r.carrier}</td>
                      <td className="py-2 text-right font-mono">{r.checks}</td>
                      <td className={`py-2 text-right font-mono ${r.criticals > 0 ? "text-flag" : ""}`}>
                        {r.criticals}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {/* Recent checks */}
          <section className="rounded-lg border border-line bg-card p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold">Recent checks</h2>
              <Link href="/checks" className="text-sm underline">
                View all
              </Link>
            </div>
            <ul className="divide-y divide-line/60">
              {stats.recent.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/checks/${c.id}`}
                    className="flex items-center justify-between gap-4 py-3 hover:bg-paper"
                  >
                    <span className="min-w-0 flex-1 truncate font-medium">{c.label}</span>
                    <span className="font-mono text-xs text-ink/50">{c.policy_type}</span>
                    <span
                      className={`font-mono text-xs uppercase tracking-wide ${
                        c.status === "failed"
                          ? "text-flag"
                          : c.status === "reviewed"
                            ? "text-verify"
                            : "text-ink/60"
                      }`}
                    >
                      {STATUS_LABEL[c.status] ?? c.status}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </AppShell>
  );
}
