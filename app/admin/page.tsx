import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { AppShell } from "@/app/components/AppShell";
import { AgencyForm, DangerZone } from "@/app/settings/SettingsForms";
import { TeamSection } from "@/app/settings/TeamSection";
import { isAdmin, isSystemAdmin, canManageUsers, roleRank } from "@/lib/roles";
import { createAdminClient } from "@/lib/supabase/admin";

function Section({
  id,
  title,
  children,
}: {
  id?: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="rounded-lg border border-line bg-card p-6">
      <h2 className="mb-4 font-semibold">{title}</h2>
      {children}
    </section>
  );
}

/**
 * The Admin hub: every agency-level control, sectioned by role. Managers get
 * Team; admins add Integrations, Configuration, Billing, and the Danger
 * zone; the operator gets the platform ops console link. Personal settings
 * live in Settings.
 */
export default async function AdminHubPage() {
  const { supabase, profile, agency } = await requireProfile();
  if (!canManageUsers(profile)) notFound();
  const admin = isAdmin(profile);

  const { data: members } = await supabase
    .from("profiles")
    .select("id, user_id, full_name, role, suspended_at")
    .order("created_at", { ascending: true });

  // Login email + last sign-in come from auth (service role, server only).
  const authInfo = new Map<string, { email: string; lastSignIn: string | null }>();
  let pendingInvites: { id: string; email: string; role: string; created_at: string }[] = [];
  const svc = createAdminClient();
  if (svc) {
    const { data: list } = await svc.auth.admin.listUsers({ perPage: 1000 });
    for (const u of list?.users ?? []) {
      authInfo.set(u.id, { email: u.email ?? "", lastSignIn: u.last_sign_in_at ?? null });
    }
    if (admin) {
      const { data: inv } = await svc
        .from("invites")
        .select("id, email, role, created_at")
        .eq("agency_id", agency.id)
        .is("accepted_at", null)
        .order("created_at", { ascending: false });
      pendingInvites = inv ?? [];
    }
  }
  const enrichedMembers = (members ?? []).map((m) => ({
    id: m.id,
    full_name: m.full_name,
    role: m.role,
    suspended: !!m.suspended_at,
    email: authInfo.get(m.user_id)?.email ?? "",
    lastSignIn: authInfo.get(m.user_id)?.lastSignIn ?? null,
    manageable: roleRank(m.role) < roleRank(profile.role) && m.id !== profile.id,
  }));

  return (
    <AppShell agency={agency} profile={profile} active="/admin">
      <h1 className="mb-8 text-2xl font-semibold">Admin</h1>
      <div className="grid max-w-3xl gap-6">
        {isSystemAdmin(profile) && (
          <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-ink bg-card p-6">
            <div>
              <h2 className="font-semibold">Platform ops console</h2>
              <p className="text-sm text-ink/60">
                Every client&apos;s setup, AI cost and drift, announcements, letter
                prompts, legal documents, audit exports.
              </p>
            </div>
            <Link
              href="/ops"
              className="rounded bg-ink px-4 py-2 text-sm font-semibold text-paper hover:bg-ink/90"
            >
              Open ops console
            </Link>
          </section>
        )}

        <Section title="Team">
          <TeamSection
            members={enrichedMembers}
            selfId={profile.id}
            viewerIsAdmin={admin}
            pendingInvites={pendingInvites}
          />
        </Section>

        {admin && (
        <Section title="Configuration">
          <div className="space-y-8">
            <AgencyForm
              name={agency.name}
              minutes={agency.manual_check_minutes}
              premium={Number(agency.avg_account_premium)}
              rate={Number(agency.csr_hourly_rate)}
              varPct={Number(agency.premium_variance_threshold)}
              renewalPct={Number(agency.renewal_premium_threshold)}
              reminderHours={agency.reminder_hours}
            />
          </div>
        </Section>
        )}

        <Section title="Legal">
          <ul className="space-y-1 text-sm">
            <li>
              <Link href="/terms" className="underline">
                Terms of Service
              </Link>
            </li>
            <li>
              <Link href="/privacy" className="underline">
                Privacy Policy
              </Link>
            </li>
            <li>
              <Link href="/ai" className="underline">
                How we use AI (plain-language transparency page)
              </Link>
            </li>
            <li>
              <a href="/boundright-data-processing.pdf" className="underline">
                Data processing one-pager (PDF, for due diligence)
              </a>
            </li>
          </ul>
        </Section>

        {admin && (
        <Section title="Danger zone">
          <DangerZone agencyName={agency.name} />
        </Section>
        )}
      </div>
    </AppShell>
  );
}
