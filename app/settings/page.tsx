import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { AppShell } from "@/app/components/AppShell";
import {
  ProfileForm,
  PasswordForm,
  AgencyForm,
  LogoForm,
  BillingSection,
  DangerZone,
} from "./SettingsForms";
import { TeamSection, IntegrationsSection } from "./TeamSection";
import { isAdmin, canManageUsers, roleRank } from "@/lib/roles";
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

export default async function SettingsPage() {
  const { supabase, profile, agency, user } = await requireProfile();
  const admin = isAdmin(profile);
  const managesUsers = canManageUsers(profile);
  const { data: members } = managesUsers
    ? await supabase
        .from("profiles")
        .select("id, user_id, full_name, role, suspended_at")
        .order("created_at", { ascending: true })
    : { data: null };

  // Login email + last sign-in come from auth (service role, server only).
  const authInfo = new Map<string, { email: string; lastSignIn: string | null }>();
  let pendingInvites: { id: string; email: string; role: string; created_at: string }[] = [];
  if (managesUsers) {
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
    <AppShell agency={agency} profile={profile} active="/settings">
      <h1 className="mb-8 text-2xl font-semibold">Settings</h1>
      <div className="grid max-w-3xl gap-6">
        <Section title="Profile">
          <div className="space-y-8">
            <p className="text-sm">
              Your role:{" "}
              <span className="inline-flex items-center rounded border border-line px-2.5 py-1 font-mono text-xs uppercase leading-none">
                {profile.role.replace("_", " ")}
              </span>
              <span className="ml-2 text-ink/60">
                {profile.role === "system_admin"
                  ? "Operator: everything, plus the ops console."
                  : profile.role === "admin"
                    ? "Everything in your agency: configuration, team, billing."
                    : profile.role === "manager"
                      ? "Runs and reviews checks, plus agency analytics."
                      : "Runs and reviews checks."}
              </span>
            </p>
            <ProfileForm fullName={profile.full_name} email={user.email ?? ""} />
            <PasswordForm />
          </div>
        </Section>

        {managesUsers && (
        <Section title="Team">
          <TeamSection
            members={enrichedMembers}
            selfId={profile.id}
            viewerIsAdmin={admin}
            pendingInvites={pendingInvites}
          />
        </Section>
        )}

        {admin && (
        <Section title="Integrations">
          <IntegrationsSection webhookUrl={agency.notify_webhook_url} />
        </Section>
        )}

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
            <LogoForm logoUrl={agency.logo_url} />
          </div>
        </Section>
        )}

        {admin && (
        <Section id="billing" title="Billing">
          <BillingSection
            plan={agency.plan}
            hasSubscription={!!agency.stripe_customer_id}
          />
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
