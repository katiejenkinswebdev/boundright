import { requireProfile } from "@/lib/auth";
import { AppShell } from "@/app/components/AppShell";
import { CoiForm } from "./CoiForm";

export default async function CoiPage() {
  const { agency, profile } = await requireProfile();
  return (
    <AppShell agency={agency} profile={profile} active="/checks/new">
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-2 text-2xl font-semibold">Certificate checks</h1>
        <p className="mb-8 text-ink/70">
          Certificates are a volume game: upload the underlying policy once,
          add every certificate issued against it, and BoundRight verifies
          each one. Every certificate counts as one check.
        </p>
        <CoiForm />
      </div>
    </AppShell>
  );
}
