import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { AppShell } from "@/app/components/AppShell";
import { DeleteCheckButton } from "./DeleteCheckButton";

const STATUS_LABEL: Record<string, string> = {
  queued: "Queued",
  extracting: "Reading",
  comparing: "Comparing",
  ready_for_review: "Ready for review",
  reviewed: "Reviewed",
  failed: "Failed",
};

export default async function ChecksPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const { supabase, profile, agency } = await requireProfile();

  let query = supabase
    .from("checks")
    .select("id, label, policy_type, status, created_at, exported_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (q?.trim()) query = query.ilike("label", `%${q.trim()}%`);
  const { data: checks } = await query;

  // Severity chips per check (single query, grouped client-side).
  const ids = (checks ?? []).map((c) => c.id);
  const { data: findingRows } = ids.length
    ? await supabase
        .from("findings")
        .select("check_id, severity, status")
        .in("check_id", ids)
        .neq("status", "match")
    : { data: [] };
  const sevByCheck = new Map<string, { critical: number; moderate: number; minor: number }>();
  for (const f of findingRows ?? []) {
    const entry = sevByCheck.get(f.check_id) ?? { critical: 0, moderate: 0, minor: 0 };
    if (f.severity && f.severity in entry) entry[f.severity as keyof typeof entry]++;
    sevByCheck.set(f.check_id, entry);
  }

  return (
    <AppShell agency={agency} profile={profile} active="/checks">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Checks</h1>
        <Link
          href="/checks/new"
          className="rounded bg-ink px-4 py-2 font-semibold text-paper hover:bg-ink/90"
        >
          New check
        </Link>
      </div>

      <form className="mb-4" action="/checks" method="GET">
        <label htmlFor="q" className="sr-only">
          Search by client name
        </label>
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={q ?? ""}
          placeholder="Search by client or account name…"
          className="w-full max-w-sm rounded border border-line bg-card px-4 py-2"
        />
      </form>

      {(checks ?? []).length === 0 ? (
        <div className="rounded-lg border border-line bg-card p-12 text-center text-ink/70">
          {q ? `No checks match “${q}”.` : "No checks yet — run your first one."}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left">
                <th className="px-4 py-3 font-semibold">Client / account</th>
                <th className="px-4 py-3 font-semibold">Type</th>
                <th className="px-4 py-3 font-semibold">Date</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Findings</th>
                <th className="px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(checks ?? []).map((c) => {
                const sev = sevByCheck.get(c.id);
                return (
                  <tr key={c.id} className="border-b border-line/50">
                    <td className="px-4 py-3 font-medium">
                      <Link href={`/checks/${c.id}`} className="hover:underline">
                        {c.label}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{c.policy_type}</td>
                    <td className="px-4 py-3 text-ink/70">
                      {new Date(c.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`font-mono text-xs uppercase tracking-wide ${
                          c.status === "failed"
                            ? "text-flag"
                            : c.status === "reviewed"
                              ? "text-verify"
                              : "text-ink/60"
                        }`}
                      >
                        {STATUS_LABEL[c.status] ?? c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {sev ? (
                        <>
                          {sev.critical > 0 && <span className="text-flag">{sev.critical}C </span>}
                          {sev.moderate > 0 && <span className="text-caution">{sev.moderate}M </span>}
                          {sev.minor > 0 && <span className="text-ink/50">{sev.minor}m</span>}
                          {sev.critical + sev.moderate + sev.minor === 0 && (
                            <span className="text-verify">clean</span>
                          )}
                        </>
                      ) : (
                        <span className="text-ink/40">—</span>
                      )}
                    </td>
                    <td className="space-x-3 px-4 py-3">
                      <Link href={`/checks/${c.id}`} className="underline">
                        View
                      </Link>
                      {c.status === "reviewed" && (
                        <a href={`/api/checks/${c.id}/report`} className="underline">
                          Export
                        </a>
                      )}
                      <DeleteCheckButton checkId={c.id} label={c.label} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}
