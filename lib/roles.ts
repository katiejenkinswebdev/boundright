import type { Profile } from "@/lib/auth";

export type Role = "system_admin" | "admin" | "manager" | "user";

/** Managers and above see dashboard analytics (KPIs, trends, carrier rates). */
export function canSeeAnalytics(profile: Profile): boolean {
  return ["system_admin", "admin", "manager"].includes(profile.role);
}

/** Agency admins (and the operator) manage settings, billing, team, deletion. */
export function isAdmin(profile: Profile): boolean {
  return profile.role === "admin" || profile.role === "system_admin";
}

/** The operator role: granted manually in the database, never via the team UI. */
export function isSystemAdmin(profile: Profile): boolean {
  return profile.role === "system_admin";
}

/** Numeric rank for "who may manage whom": manage only strictly lower ranks. */
export function roleRank(role: string): number {
  return { user: 1, manager: 2, admin: 3, system_admin: 4 }[role as Role] ?? 0;
}

/** Managers and above manage team members (below their own rank). */
export function canManageUsers(profile: Profile): boolean {
  return canSeeAnalytics(profile);
}
