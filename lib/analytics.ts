import posthog from "posthog-js";

/**
 * Product analytics: PostHog, keyless-safe. Without NEXT_PUBLIC_POSTHOG_KEY
 * every call is a no-op, so dev/CI never phone home. Event names are the
 * catalog below — always a named event with typed-out properties, never
 * free-form strings scattered through components.
 *
 * Privacy: autocapture masks all element text (check labels carry client
 * names). Only the named events + ids below leave the app; document
 * contents never do. The first-party `events` table remains the durable
 * per-agency record; PostHog is the funnel/behavior lens on top.
 */
export const PH_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;

let initialized = false;

export function initAnalytics(): boolean {
  if (!PH_KEY || typeof window === "undefined") return false;
  if (!initialized) {
    posthog.init(PH_KEY, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
      capture_pageview: false, // captured manually on App Router route changes
      autocapture: true,
      mask_all_text: true, // labels contain client names; structure only
      persistence: "localStorage+cookie",
    });
    initialized = true;
  }
  return true;
}

/** Named product events. Add here first, then call track(). */
export type AnalyticsEvent =
  | "check_created"
  | "sample_check_started"
  | "check_marked_reviewed"
  | "finding_confirmed"
  | "finding_dismissed"
  | "letter_drafted"
  | "letter_copied"
  | "report_exported"
  | "period_report_generated"
  | "smart_intake_classified"
  | "smart_intake_run"
  | "check_archived"
  | "check_restored"
  | "check_deleted"
  | "ai_rated"
  | "feedback_sent"
  | "checkout_started"
  | "table_page_size_changed"
  | "mfa_enrolled"
  | "mfa_disabled"
  | "member_password_reset"
  | "member_access_changed"
  | "member_removed"
  | "ops_client_created";

export function track(event: AnalyticsEvent, props?: Record<string, unknown>): void {
  if (!initAnalytics()) return;
  posthog.capture(event, props);
}

export function identify(
  userId: string,
  agency: { id: string; name: string; plan: string },
  role: string
): void {
  if (!initAnalytics()) return;
  posthog.identify(userId, { role });
  posthog.group("agency", agency.id, { name: agency.name, plan: agency.plan });
}

export function pageview(): void {
  if (!initAnalytics()) return;
  posthog.capture("$pageview");
}
