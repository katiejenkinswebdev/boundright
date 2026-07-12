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
import { isAdmin } from "@/lib/roles";

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
  const { data: members } = admin
    ? await supabase
        .from("profiles")
        .select("id, full_name, role")
        .order("created_at", { ascending: true })
    : { data: null };

  return (
    <AppShell agency={agency} profile={profile} active="/settings">
      <h1 className="mb-8 text-2xl font-semibold">Settings</h1>
      <div className="grid max-w-3xl gap-6">
        <Section title="Profile">
          <div className="space-y-8">
            <p className="text-sm">
              Your role:{" "}
              <span className="rounded border border-line px-2 py-0.5 font-mono text-xs uppercase">
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

        {admin && (
        <Section title="Team">
          <TeamSection members={members ?? []} selfId={profile.id} />
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
