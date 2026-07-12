import Link from "next/link";
import { cookies } from "next/headers";
import { createServerSupabase } from "@/lib/supabase/server";
import { signOut } from "@/app/actions/auth";
import type { Agency, Profile } from "@/lib/auth";
import { planCap } from "@/lib/pricing";
import { AppShellChrome } from "./AppShellChrome";
import { AnalyticsIdentify } from "./Analytics";
import { FeedbackWidget } from "./FeedbackWidget";

// Server-rendered per request; reading the clock here (outside the component
// body) keeps the render itself pure.
function daysUntil(iso: string): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));
}

function isInFuture(iso: string): boolean {
  return new Date(iso).getTime() > Date.now();
}

export async function AppShell({
  agency,
  profile,
  active,
  children,
}: {
  agency: Agency;
  profile: Profile;
  active: string;
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const initialCollapsed = cookieStore.get("br_sidebar")?.value === "collapsed";

  const supabase = await createServerSupabase();
  const [{ count: awaitingCount }, { data: announcement }] = await Promise.all([
    supabase
      .from("checks")
      .select("id", { count: "exact", head: true })
      .eq("status", "ready_for_review")
      .is("archived_at", null),
    // RLS only returns announcements inside their active window, so the
    // banner shows and hides itself on the configured dates.
    supabase
      .from("announcements")
      .select("id, message, link_url")
      .order("starts_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const trialDaysLeft = agency.trial_ends_at ? daysUntil(agency.trial_ends_at) : null;
  const cap = planCap(agency.plan);
  const graceActive =
    agency.billing_status === "past_due" &&
    agency.billing_grace_until &&
    isInFuture(agency.billing_grace_until);

  const banner = (
    <>
      {announcement && (
        <div className="border-b border-line bg-ink px-6 py-2 text-sm text-paper">
          {announcement.message}
          {announcement.link_url && (
            <>
              {" "}
              <a href={announcement.link_url} className="underline">
                Learn more
              </a>
            </>
          )}
        </div>
      )}
      {agency.plan === "trial" && trialDaysLeft !== null && (
        <div className="border-b border-line bg-card px-6 py-2 text-sm text-ink/70">
          Trial: {trialDaysLeft} day{trialDaysLeft === 1 ? "" : "s"} and{" "}
          {Math.max(0, cap - agency.checks_this_period)} of {cap} checks
          remaining.{" "}
          <Link href="/settings#billing" className="underline">
            Subscribe
          </Link>
        </div>
      )}
      {agency.billing_status === "past_due" && (
        <div className="border-b border-caution/50 bg-caution/10 px-6 py-2 text-sm">
          {graceActive
            ? "Your last payment didn't go through. Update your card in Settings → Billing to keep running checks."
            : "Payment is past due, so new checks are paused. Update your card in Settings → Billing."}
        </div>
      )}
      {agency.billing_status === "canceled" && (
        <div className="border-b border-line bg-card px-6 py-2 text-sm text-ink/70">
          Your subscription has ended. Your data and reports remain available;
          resubscribe in Settings → Billing to run new checks.
        </div>
      )}
    </>
  );

  const sidebarFooter = (
    <>
      <a href="mailto:help@boundright.app" className="block text-sm underline">
        Help
      </a>
      <FeedbackWidget />
      <p className="text-sm text-ink/60">{profile.full_name}</p>
      <form action={signOut}>
        <button type="submit" className="text-sm underline">
          Sign out
        </button>
      </form>
    </>
  );

  return (
    <>
    <AnalyticsIdentify
      userId={profile.user_id}
      agencyId={agency.id}
      agencyName={agency.name}
      plan={agency.plan}
      role={profile.role}
    />
    <AppShellChrome
      active={active}
      awaitingCount={awaitingCount ?? 0}
      initialCollapsed={initialCollapsed}
      banner={banner}
      coBrand={{ logoUrl: agency.logo_url, name: agency.name }}
      sidebarFooter={sidebarFooter}
    >
      {children}
    </AppShellChrome>
    </>
  );
}
