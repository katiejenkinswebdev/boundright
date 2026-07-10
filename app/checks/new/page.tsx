import Link from "next/link";
import { Lockup } from "@/app/components/brand";
import { requireProfile } from "@/lib/auth";
import { NewCheckForm } from "./NewCheckForm";

export default async function NewCheckPage() {
  const { agency } = await requireProfile();
  const cap = agency.plan === "trial" ? 10 : 150;

  return (
    <main className="mx-auto w-full max-w-[1100px] flex-1 px-6 py-8">
      <header className="mb-8 flex items-center justify-between">
        <Link href="/dashboard">
          <Lockup />
        </Link>
        <span className="font-mono text-sm text-ink/60">
          {agency.checks_this_period} of {cap} checks used
        </span>
      </header>

      <div className="mx-auto max-w-2xl">
        <h1 className="mb-2 text-2xl font-semibold">New check</h1>
        <p className="mb-8 text-ink/70">
          Upload the proposal or binder you sold and the policy the carrier
          issued. BoundRight compares them field by field.
        </p>
        <div className="rounded-lg border border-line bg-card p-8">
          <NewCheckForm />
        </div>
      </div>
    </main>
  );
}
