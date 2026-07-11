import { requireProfile } from "@/lib/auth";
import { AppShell } from "@/app/components/AppShell";
import { BatchForm } from "./BatchForm";

export default async function BatchPage() {
  const { agency, profile } = await requireProfile();

  return (
    <AppShell agency={agency} profile={profile} active="/checks/new">
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-2 text-2xl font-semibold">Batch checks</h1>
        <p className="mb-8 text-ink/70">
          Renewal season mode: queue several document pairs and BoundRight
          runs them all. Each pair counts as one check.
        </p>
        <BatchForm />
      </div>
    </AppShell>
  );
}
