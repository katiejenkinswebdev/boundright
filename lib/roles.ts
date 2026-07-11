import type { Profile } from "@/lib/auth";

export type Role = "admin" | "manager" | "user";

/** Managers and admins see dashboard analytics (KPIs, trends, carrier rates). */
export function canSeeAnalytics(profile: Profile): boolean {
  return profile.role === "admin" || profile.role === "manager";
}

/** Admins manage the agency: settings, billing, team, integrations, deletion. */
export function isAdmin(profile: Profile): boolean {
  return profile.role === "admin";
}
