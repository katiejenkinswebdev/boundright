"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { identify, pageview } from "@/lib/analytics";

/** Captures a pageview on every App Router navigation. Lives in the root layout. */
export function AnalyticsPageviews() {
  const pathname = usePathname();
  useEffect(() => {
    pageview();
  }, [pathname]);
  return null;
}

/** Ties events to the signed-in user + agency group. Lives in AppShell. */
export function AnalyticsIdentify({
  userId,
  agencyId,
  agencyName,
  plan,
  role,
}: {
  userId: string;
  agencyId: string;
  agencyName: string;
  plan: string;
  role: string;
}) {
  useEffect(() => {
    identify(userId, { id: agencyId, name: agencyName, plan }, role);
  }, [userId, agencyId, agencyName, plan, role]);
  return null;
}
