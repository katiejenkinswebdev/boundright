import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { getDashboardStats } from "@/lib/stats";
import { AppShell } from "@/app/components/AppShell";
import { TrendChart } from "@/app/components/TrendChart";
import { MonthlyReportButton } from "./MonthlyReportButton";

const STATUS_LABEL: Record<string, string> = {
  queued: "Queued",
  extracting: "Reading documents",
  comparing: "Comparing",
  ready_for_review: "Ready for review",
  reviewed: "Reviewed",
  failed: "Failed",
};

export default async function DashboardPage() {
  const { supabase, profile, agency } = await requireProfile();
  const stats = await getDashboardStats(supabase, agency);
  const hasAnyChecks = stats.recent.length > 0;

  return (
    <AppShell agency={agency} profile={profile} active="/dashboard">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-ink/60">{agency.name}</p>
        </div>
        <MonthlyReportButton />
      </div>

      {!hasAnyChecks ? (
        <section className="flex flex-col items-center rounded-lg border border-line bg-card px-8 py-20 text-center">
          <h2 className="text-2xl font-semibold">
            Run your first check and see your dashboard come alive.
          </h2>
          <p className="mt-3 max-w-md text-ink/70">
            Upload a proposal and its issued policy — BoundRight compares them
            field by field and hands you a cited report to review.
          </p>
          <Link
            href="/checks/new"
            className="mt-8 rounded bg-ink px-6 py-3 font-semibold text-paper hover:bg-ink/90"
          >
            Run a check
          </Link>
        </section>
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
              <p className="text-sm text-ink/60">Confirmed discrepancies</p>
              <p className="mt-1 text-3xl font-semibold">{stats.confirmedTotal}</p>
              <p className="mt-3 text-xs text-ink/60">
                <span className="text-flag">{stats.confirmedBySeverity.critical} critical</span>
                {" · "}
                <span className="text-caution">{stats.confirmedBySeverity.moderate} moderate</span>
                {" · "}
                {stats.confirmedBySeverity.minor} minor
              </p>
            </div>

            <div
              className="rounded-lg border border-line bg-card p-5"
              title={`${stats.trend.reduce((s, p) => s + p.checks, 0)} checks × ${agency.manual_check_minutes} min ÷ 60 — based on your assumptions`}
            >
              <p className="text-sm text-ink/60">Hours saved</p>
              <p className="mt-1 text-3xl font-semibold">{stats.hoursSaved.toFixed(1)}</p>
              <p className="mt-3 text-xs text-ink/60">
                Checks × your {agency.manual_check_minutes}-min manual review.{" "}
                <Link href="/settings" className="underline">
                  Edit assumptions
                </Link>
              </p>
            </div>

            <div className="rounded-lg border border-line bg-card p-5">
              <p className="text-sm text-ink/60">Exposure flagged</p>
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
