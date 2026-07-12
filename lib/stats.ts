import type { SupabaseClient } from "@supabase/supabase-js";
import type { Agency } from "@/lib/auth";

export type MonthPoint = {
  month: string; // bucket label ("Feb", "Jul 8", "wk Jul 6")
  monthKey: string;
  checks: number;
  confirmed: number;
  critical: number;
  moderate: number;
  minor: number;
};

export type StatsRange = { from: Date; to: Date; label: string };

export type DashboardStats = {
  checksThisPeriod: number;
  cap: number;
  confirmedTotal: number;
  confirmedBySeverity: { critical: number; moderate: number; minor: number };
  hoursSaved: number;
  exposureFlagged: number;
  trend: MonthPoint[];
  rangeLabel: string;
  recent: {
    id: string;
    label: string;
    policy_type: string;
    status: string;
    created_at: string;
  }[];
};

export const RANGE_PRESETS: Record<string, { days: number; label: string }> = {
  "7d": { days: 7, label: "the last week" },
  "1m": { days: 31, label: "the last month" },
  "3m": { days: 92, label: "the last 3 months" },
  "6m": { days: 183, label: "the last 6 months" },
  "1y": { days: 365, label: "the last year" },
};

const DAY = 86_400_000;

export function resolveRange(params: {
  range?: string;
  from?: string;
  to?: string;
}): StatsRange {
  const parse = (s?: string) => {
    if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
    const d = new Date(`${s}T00:00:00Z`);
    return Number.isNaN(d.getTime()) ? null : d;
  };
  const from = parse(params.from);
  const to = parse(params.to);
  if (from && to) {
    const [a, bRaw] = from <= to ? [from, to] : [to, from];
    // End of the chosen "to" day, capped to a 400-day span.
    const b = new Date(Math.min(bRaw.getTime() + DAY, a.getTime() + 400 * DAY));
    return {
      from: a,
      to: b,
      label: `${a.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })} to ${new Date(b.getTime() - DAY).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}`,
    };
  }
  const preset = RANGE_PRESETS[params.range ?? "6m"] ?? RANGE_PRESETS["6m"];
  const now = new Date();
  return {
    from: new Date(now.getTime() - preset.days * DAY),
    to: now,
    label: preset.label,
  };
}

type Bucket = { start: Date; end: Date; label: string; key: string };

function buildBuckets(range: StatsRange): Bucket[] {
  const spanDays = (range.to.getTime() - range.from.getTime()) / DAY;
  const buckets: Bucket[] = [];
  const short = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

  if (spanDays <= 32) {
    for (let t = range.from.getTime(); t < range.to.getTime(); t += DAY) {
      const start = new Date(t);
      buckets.push({
        start,
        end: new Date(Math.min(t + DAY, range.to.getTime())),
        label: short(start),
        key: start.toISOString().slice(0, 10),
      });
    }
  } else if (spanDays <= 100) {
    for (let t = range.from.getTime(); t < range.to.getTime(); t += 7 * DAY) {
      const start = new Date(t);
      buckets.push({
        start,
        end: new Date(Math.min(t + 7 * DAY, range.to.getTime())),
        label: `wk ${short(start)}`,
        key: start.toISOString().slice(0, 10),
      });
    }
  } else {
    const first = new Date(Date.UTC(range.from.getUTCFullYear(), range.from.getUTCMonth(), 1));
    for (
      let d = first;
      d < range.to;
      d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))
    ) {
      const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
      buckets.push({
        start: d < range.from ? range.from : d,
        end: end > range.to ? range.to : end,
        label: d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }),
        key: d.toISOString().slice(0, 7),
      });
    }
  }
  return buckets;
}

/** All queries run under the caller's RLS-scoped client. */
export async function getDashboardStats(
  supabase: SupabaseClient,
  agency: Agency,
  range: StatsRange
): Promise<DashboardStats> {
  const fromIso = range.from.toISOString();
  const toIso = range.to.toISOString();

  const [checksRes, confirmedRes, recentRes] = await Promise.all([
    supabase
      .from("checks")
      .select("id, created_at, status")
      .gte("created_at", fromIso)
      .lt("created_at", toIso)
      .in("status", ["ready_for_review", "reviewed"]),
    supabase
      .from("findings")
      .select("id, severity, created_at")
      .eq("reviewer_action", "confirmed")
      .neq("status", "match")
      .gte("created_at", fromIso)
      .lt("created_at", toIso),
    supabase
      .from("checks")
      .select("id, label, policy_type, status, created_at")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const checks = checksRes.data ?? [];
  const confirmed = confirmedRes.data ?? [];

  const bySeverity = { critical: 0, moderate: 0, minor: 0 };
  for (const f of confirmed) {
    if (f.severity && f.severity in bySeverity) {
      bySeverity[f.severity as keyof typeof bySeverity]++;
    }
  }

  const trend: MonthPoint[] = buildBuckets(range).map((b) => {
    const inBucket = (iso: string) => {
      const t = new Date(iso).getTime();
      return t >= b.start.getTime() && t < b.end.getTime();
    };
    const monthFindings = confirmed.filter((f) => inBucket(f.created_at));
    return {
      monthKey: b.key,
      month: b.label,
      checks: checks.filter((c) => inBucket(c.created_at)).length,
      confirmed: monthFindings.length,
      critical: monthFindings.filter((f) => f.severity === "critical").length,
      moderate: monthFindings.filter((f) => f.severity === "moderate").length,
      minor: monthFindings.filter((f) => f.severity === "minor").length,
    };
  });

  const hoursSaved = (checks.length * agency.manual_check_minutes) / 60;
  const exposureFlagged = bySeverity.critical * Number(agency.avg_account_premium);

  return {
    checksThisPeriod: agency.checks_this_period,
    cap: agency.plan === "trial" ? 10 : 150,
    confirmedTotal: confirmed.length,
    confirmedBySeverity: bySeverity,
    hoursSaved,
    exposureFlagged,
    trend,
    rangeLabel: range.label,
    recent: recentRes.data ?? [],
  };
}
