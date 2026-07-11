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
  const { profile, agency, user } = await requireProfile();

  return (
    <AppShell agency={agency} profile={profile} active="/settings">
      <h1 className="mb-8 text-2xl font-semibold">Settings</h1>
      <div className="grid max-w-3xl gap-6">
        <Section title="Profile">
          <div className="space-y-8">
            <ProfileForm fullName={profile.full_name} email={user.email ?? ""} />
            <PasswordForm />
          </div>
        </Section>

        <Section title="Agency">
          <div className="space-y-8">
            <AgencyForm
              name={agency.name}
              minutes={agency.manual_check_minutes}
              premium={Number(agency.avg_account_premium)}
              rate={Number(agency.csr_hourly_rate)}
            />
            <LogoForm logoUrl={agency.logo_url} />
          </div>
        </Section>

        <Section id="billing" title="Billing">
          <BillingSection
            plan={agency.plan}
            hasSubscription={!!agency.stripe_customer_id}
          />
        </Section>

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
              <a href="/boundright-data-processing.pdf" className="underline">
                Data processing one-pager (PDF, for due diligence)
              </a>
            </li>
          </ul>
        </Section>

        <Section title="Danger zone">
          <DangerZone agencyName={agency.name} />
        </Section>
      </div>
    </AppShell>
  );
}
