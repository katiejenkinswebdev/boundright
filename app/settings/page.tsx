import { requireProfile } from "@/lib/auth";
import { AppShell } from "@/app/components/AppShell";
import { ProfileForm, PasswordForm } from "./SettingsForms";
import { MfaSection } from "./MfaSection";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-line bg-card p-6">
      <h2 className="mb-4 font-semibold">{title}</h2>
      {children}
    </section>
  );
}

/** Personal settings only; agency-level controls live under Admin. */
export default async function SettingsPage() {
  const { supabase, profile, agency, user } = await requireProfile();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const enrolledFactorId = factors?.totp?.[0]?.id ?? null;

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

        <Section title="Security">
          <MfaSection enrolledFactorId={enrolledFactorId} />
        </Section>

        <Section title="Legal">
          <ul className="space-y-1 text-sm">
            <li><a href="/terms" className="underline">Terms of Service</a></li>
            <li><a href="/privacy" className="underline">Privacy Policy</a></li>
            <li><a href="/ai" className="underline">How we use AI (plain-language transparency page)</a></li>
            <li><a href="/boundright-data-processing.pdf" className="underline">Data processing one-pager (PDF)</a></li>
          </ul>
        </Section>
      </div>
    </AppShell>
  );
}
