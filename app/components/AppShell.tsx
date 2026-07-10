import Link from "next/link";
import { Lockup, Wordmark } from "@/app/components/brand";
import { signOut } from "@/app/actions/auth";
import type { Agency, Profile } from "@/lib/auth";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/checks/new", label: "New Check" },
  { href: "/checks", label: "Checks" },
  { href: "/settings", label: "Settings" },
];

// Server-rendered per request; reading the clock here (outside the component
// body) keeps the render itself pure.
function daysUntil(iso: string): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));
}

function isInFuture(iso: string): boolean {
  return new Date(iso).getTime() > Date.now();
}

export function AppShell({
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
  const trialDaysLeft = agency.trial_ends_at ? daysUntil(agency.trial_ends_at) : null;
  const cap = agency.plan === "trial" ? 10 : 150;
  const graceActive =
    agency.billing_status === "past_due" &&
    agency.billing_grace_until &&
    isInFuture(agency.billing_grace_until);

  return (
    <div className="flex min-h-screen flex-1">
      <aside className="hidden w-56 shrink-0 flex-col border-r border-line bg-card px-4 py-6 sm:flex">
        <Link href="/dashboard" className="mb-8 px-2">
          <Lockup />
        </Link>
        <nav className="flex flex-col gap-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded px-3 py-2 font-medium ${
                active === item.href
                  ? "bg-ink text-paper"
                  : "text-ink/80 hover:bg-paper"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto space-y-3 px-2">
          <a href="mailto:help@boundright.app" className="block text-sm underline">
            Help
          </a>
          <p className="text-sm text-ink/60">{profile.full_name}</p>
          <form action={signOut}>
            <button type="submit" className="text-sm underline">
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="flex items-center justify-between border-b border-line bg-card px-4 py-3 sm:hidden">
          <Link href="/dashboard" className="text-lg">
            <Wordmark />
          </Link>
          <nav className="flex gap-3 text-sm">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} className={active === item.href ? "font-semibold underline" : ""}>
                {item.label.replace("New Check", "New")}
              </Link>
            ))}
          </nav>
        </header>

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

        <main className="mx-auto w-full max-w-[1100px] flex-1 px-6 py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
