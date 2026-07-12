import type { SupabaseClient } from "@supabase/supabase-js";
import type { Agency } from "@/lib/auth";

export type MonthPoint = {
  month: string; // "Feb"
  monthKey: string; // "2026-02"
  checks: number;
  confirmed: number;
  critical: number;
  moderate: number;
  minor: number;
};

export type DashboardStats = {
  checksThisPeriod: number;
  cap: number;
  confirmedTotal: number;
  confirmedBySeverity: { critical: number; moderate: number; minor: number };
  hoursSaved: number;
  exposureFlagged: number;
  trend: MonthPoint[];
  recent: {
    id: string;
    label: string;
    policy_type: string;
    status: string;
    created_at: string;
  }[];
};

function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** All queries run under the caller's RLS-scoped client. */
export async function getDashboardStats(
  supabase: SupabaseClient,
  agency: Agency
): Promise<DashboardStats> {
  const now = new Date();
  const sixMonthsAgo = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1)
  );

  const [checksRes, confirmedRes, recentRes] = await Promise.all([
    supabase
      .from("checks")
      .select("id, created_at, status")
      .gte("created_at", sixMonthsAgo.toISOString())
      .in("status", ["ready_for_review", "reviewed"]),
    supabase
      .from("findings")
      .select("id, severity, created_at")
      .eq("reviewer_action", "confirmed")
      .neq("status", "match"),
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

  // Trend: last 6 calendar months.
  const trend: MonthPoint[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const key = monthKey(d);
    const monthFindings = confirmed.filter(
      (f) => monthKey(new Date(f.created_at)) === key
    );
    trend.push({
      monthKey: key,
      month: d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }),
      checks: checks.filter((c) => monthKey(new Date(c.created_at)) === key).length,
      confirmed: monthFindings.length,
      critical: monthFindings.filter((f) => f.severity === "critical").length,
      moderate: monthFindings.filter((f) => f.severity === "moderate").length,
      minor: monthFindings.filter((f) => f.severity === "minor").length,
    });
  }

  const completedAllTime = checks.length; // 6-month window is the ROI window shown
  const hoursSaved = (completedAllTime * agency.manual_check_minutes) / 60;
  const exposureFlagged = bySeverity.critical * Number(agency.avg_account_premium);

  return {
    checksThisPeriod: agency.checks_this_period,
    cap: agency.plan === "trial" ? 10 : 150,
    confirmedTotal: confirmed.length,
    confirmedBySeverity: bySeverity,
    hoursSaved,
    exposureFlagged,
    trend,
    recent: recentRes.data ?? [],
  };
}
