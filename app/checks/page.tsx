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

const STATUS_FILTERS = [
  ["all", "All"],
  ["ready_for_review", "Needs review"],
  ["reviewed", "Reviewed"],
  ["failed", "Failed"],
] as const;
const TYPE_FILTERS = [
  ["all", "All types"],
  ["issuance", "Issuance"],
  ["renewal", "Renewal"],
  ["coi", "Certificate"],
] as const;

export default async function ChecksPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; type?: string }>;
}) {
  const { q, status: statusFilter = "all", type: typeFilter = "all" } = await searchParams;
  const { supabase, profile, agency } = await requireProfile();

  let query = supabase
    .from("checks")
    .select("id, label, policy_type, check_type, status, created_at, exported_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (q?.trim()) query = query.ilike("label", `%${q.trim()}%`);
  if (statusFilter !== "all") query = query.eq("status", statusFilter);
  if (typeFilter !== "all") query = query.eq("check_type", typeFilter);
  const { data: checks } = await query;

  const filterHref = (s: string, t: string) => {
    const p = new URLSearchParams();
    if (q?.trim()) p.set("q", q.trim());
    if (s !== "all") p.set("status", s);
    if (t !== "all") p.set("type", t);
    const qs = p.toString();
    return `/checks${qs ? `?${qs}` : ""}`;
  };

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

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {STATUS_FILTERS.map(([value, label]) => (
          <Link
            key={value}
            href={filterHref(value, typeFilter)}
            className={`rounded px-3 py-1 text-sm font-medium ${
              statusFilter === value ? "bg-ink text-paper" : "border border-line text-ink/70 hover:border-ink"
            }`}
          >
            {label}
          </Link>
        ))}
        <span className="mx-1 text-line">|</span>
        {TYPE_FILTERS.map(([value, label]) => (
          <Link
            key={value}
            href={filterHref(statusFilter, value)}
            className={`rounded px-3 py-1 text-sm font-medium ${
              typeFilter === value ? "bg-ink text-paper" : "border border-line text-ink/70 hover:border-ink"
            }`}
          >
            {label}
          </Link>
        ))}
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
          {q ? `No checks match “${q}”.` : "No checks yet. Run your first one."}
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
                    <td className="px-4 py-3">
                      <SeverityPills
                        sev={sev}
                        done={c.status === "ready_for_review" || c.status === "reviewed"}
                      />
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

/**
 * Findings at a glance: spelled-out severity pills matching the report's
 * badge language. No initials; a 58-year-old principal reads this cold.
 */
function SeverityPills({
  sev,
  done,
}: {
  sev: { critical: number; moderate: number; minor: number } | undefined;
  done: boolean;
}) {
  if (!done) return <span className="text-ink/40">—</span>;
  const counts = sev ?? { critical: 0, moderate: 0, minor: 0 };
  const pills = [
    { n: counts.critical, word: "critical", cls: "border-flag text-flag" },
    { n: counts.moderate, word: "moderate", cls: "border-caution text-caution" },
    { n: counts.minor, word: "minor", cls: "border-line text-ink/60" },
  ].filter((p) => p.n > 0);

  if (pills.length === 0) {
    return (
      <span className="inline-block rounded-full border border-verify px-2 py-0.5 font-mono text-xs text-verify">
        all matched
      </span>
    );
  }
  return (
    <span className="flex flex-wrap gap-1">
      {pills.map((p) => (
        <span
          key={p.word}
          className={`inline-block whitespace-nowrap rounded-full border px-2 py-0.5 font-mono text-xs ${p.cls}`}
        >
          {p.n} {p.word}
        </span>
      ))}
    </span>
  );
}
