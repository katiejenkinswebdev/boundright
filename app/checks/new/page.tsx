import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { AppShell } from "@/app/components/AppShell";
import { NewCheckForm } from "./NewCheckForm";
import { SmartIntake } from "./SmartIntake";

export default async function NewCheckPage({
  searchParams,
}: {
  searchParams: Promise<{ classic?: string }>;
}) {
  const { classic } = await searchParams;
  const { agency, profile } = await requireProfile();
  const cap = agency.plan === "trial" ? 10 : 150;
  const smartIntake = agency.smart_intake_enabled && classic !== "1";

  return (
    <AppShell agency={agency} profile={profile} active="/checks/new">
      <div className="mx-auto max-w-2xl">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-2xl font-semibold">New check</h1>
          <span className="font-mono text-sm text-ink/60">
            {agency.checks_this_period} of {cap} checks used
          </span>
        </div>
        {smartIntake ? (
          <>
            <p className="mb-8 text-ink/70">
              Drop every document at once. BoundRight classifies each one,
              proposes the pairs, and runs the checks you confirm.
            </p>
            <SmartIntake />
          </>
        ) : (
          <>
            <p className="mb-8 text-ink/70">
              Pick what you&apos;re checking, upload the two documents, and
              BoundRight compares them field by field. Several to run?{" "}
              <Link href="/checks/batch" className="underline">
                Use batch mode
              </Link>
              . Many certificates against one policy?{" "}
              <Link href="/checks/coi" className="underline">
                Use the certificate flow
              </Link>
              .
              {agency.smart_intake_enabled && (
                <>
                  {" "}Or drop everything at once with{" "}
                  <Link href="/checks/new" className="underline">
                    smart intake
                  </Link>
                  .
                </>
              )}
            </p>
            <div className="rounded-lg border border-line bg-card p-8">
              <NewCheckForm />
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
