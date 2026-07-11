import { requireProfile } from "@/lib/auth";
import { AppShell } from "@/app/components/AppShell";
import { NewCheckForm } from "./NewCheckForm";

export default async function NewCheckPage() {
  const { agency, profile } = await requireProfile();
  const cap = agency.plan === "trial" ? 10 : 150;

  return (
    <AppShell agency={agency} profile={profile} active="/checks/new">
      <div className="mx-auto max-w-2xl">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-2xl font-semibold">New check</h1>
          <span className="font-mono text-sm text-ink/60">
            {agency.checks_this_period} of {cap} checks used
          </span>
        </div>
        <p className="mb-8 text-ink/70">
          Upload the proposal or binder you sold and the policy the carrier
          issued. BoundRight compares them field by field.
        </p>
        <div className="rounded-lg border border-line bg-card p-8">
          <NewCheckForm />
        </div>
      </div>
    </AppShell>
  );
}
