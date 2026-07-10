import { requireProfile } from "@/lib/auth";
import { signOut } from "@/app/actions/auth";

export default async function DashboardPage() {
  const { profile, agency } = await requireProfile();

  return (
    <main className="mx-auto w-full max-w-[1100px] flex-1 px-6 py-8">
      <header className="mb-10 flex items-center justify-between">
        <div>
          <span className="text-xl font-semibold tracking-tight">
            Bound<span className="text-verify">Right</span>
          </span>
          <p className="text-sm text-ink/60">{agency.name}</p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-ink/70">{profile.full_name}</span>
          <form action={signOut}>
            <button type="submit" className="text-sm underline">
              Sign out
            </button>
          </form>
        </div>
      </header>

      {/* Empty state — the full dashboard lands in Phase 4. */}
      <section className="flex flex-col items-center rounded-lg border border-line bg-card px-8 py-20 text-center">
        <h1 className="text-2xl font-semibold">
          Run a sample check to see your dashboard come alive.
        </h1>
        <p className="mt-3 max-w-md text-ink/70">
          We&apos;ll compare a specimen proposal against its issued policy so
          you can see exactly what a BoundRight report looks like — no risk,
          nothing uploaded.
        </p>
        <button
          type="button"
          disabled
          title="Arrives with the check pipeline (Phase 2)"
          className="mt-8 rounded bg-ink px-6 py-3 font-semibold text-paper opacity-50"
        >
          Run a sample check
        </button>
        <p className="mt-2 text-sm text-ink/50">Coming online in Phase 2.</p>
      </section>
    </main>
  );
}
