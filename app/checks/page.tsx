import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { canSeeAnalytics } from "@/lib/roles";
import { cookies } from "next/headers";
import { PageSizeSelect } from "./PageSizeSelect";
import { AppShell } from "@/app/components/AppShell";
import { DeleteCheckButton } from "./DeleteCheckButton";
import { ArchiveCheckButton } from "./ArchiveCheckButton";

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
  ["archived", "Archived"],
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
  searchParams: Promise<{
    q?: string;
    status?: string;
    type?: string;
    sort?: string;
    dir?: string;
    page?: string;
  }>;
}) {
  const {
    q,
    status: statusFilter = "all",
    type: typeFilter = "all",
    sort = "date",
    dir = "desc",
    page: pageParam = "1",
  } = await searchParams;
  const { supabase, profile, agency } = await requireProfile();

  const cookieStore = await cookies();
  const pageSize = [10, 25, 50, 100].includes(Number(cookieStore.get("br_rows")?.value))
    ? Number(cookieStore.get("br_rows")!.value)
    : 25;
  const page = Math.max(1, Number(pageParam) || 1);

  // Findings-severity sorting happens within the page (fetched rows only);
  // every other column sorts in the database across all pages.
  const dbSort: Record<string, string> = {
    label: "label",
    type: "check_type",
    date: "created_at",
    status: "status",
  };
  let query = supabase
    .from("checks")
    .select("id, label, policy_type, check_type, status, created_at, exported_at", {
      count: "exact",
    })
    .order(dbSort[sort] ?? "created_at", { ascending: dir === "asc" })
    .range((page - 1) * pageSize, page * pageSize - 1);
  if (q?.trim()) query = query.ilike("label", `%${q.trim()}%`);
  if (statusFilter === "archived") query = query.not("archived_at", "is", null);
  else {
    query = query.is("archived_at", null);
    if (statusFilter !== "all") query = query.eq("status", statusFilter);
  }
  if (typeFilter !== "all") query = query.eq("check_type", typeFilter);
  const { data: checks, count: totalCount } = await query;

  const href = (over: Record<string, string>) => {
    const p = new URLSearchParams();
    if (q?.trim()) p.set("q", q.trim());
    if (statusFilter !== "all") p.set("status", statusFilter);
    if (typeFilter !== "all") p.set("type", typeFilter);
    if (sort !== "date") p.set("sort", sort);
    if (dir !== "desc") p.set("dir", dir);
    if (page > 1) p.set("page", String(page));
    for (const [k, v] of Object.entries(over)) {
      if (v === "" || (k === "status" && v === "all") || (k === "type" && v === "all")) p.delete(k);
      else p.set(k, v);
    }
    const qs = p.toString();
    return `/checks${qs ? `?${qs}` : ""}`;
  };
  const filterHref = (s: string, t: string) => href({ status: s, type: t, page: "" });
  const sortHref = (col: string) =>
    href({ sort: col, dir: sort === col && dir === "asc" ? "desc" : "asc", page: "" });
  const arrow = (col: string) => (sort === col ? (dir === "asc" ? " ▲" : " ▼") : "");

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

  const sevScore = (id: string) => {
    const v = sevByCheck.get(id);
    return v ? v.critical * 10_000 + v.moderate * 100 + v.minor : -1;
  };
  const sorted =
    sort === "findings"
      ? [...(checks ?? [])].sort((a, b) =>
          dir === "asc" ? sevScore(a.id) - sevScore(b.id) : sevScore(b.id) - sevScore(a.id)
        )
      : (checks ?? []);
  const totalPages = Math.max(1, Math.ceil((totalCount ?? 0) / pageSize));

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
        <span className="text-sm font-semibold text-ink/60">Findings:</span>
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
        <span className="text-sm font-semibold text-ink/60">Types:</span>
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
        <div className="max-h-[70vh] overflow-x-auto overflow-y-auto rounded-lg border border-line bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="sticky top-0 z-10 border-b border-line bg-card text-left">
                {(
                  [
                    ["label", "Client / account"],
                    ["type", "Type"],
                    ["date", "Date"],
                    ["status", "Status"],
                    ["findings", "Findings"],
                  ] as const
                ).map(([col, colLabel]) => (
                  <th key={col} className="px-4 py-3 font-semibold">
                    <Link href={sortHref(col)} className="hover:underline">
                      {colLabel}
                      {arrow(col)}
                    </Link>
                  </th>
                ))}
                <th className="px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((c) => {
                const sev = sevByCheck.get(c.id);
                const unviewed = c.status === "ready_for_review";
                return (
                  <tr
                    key={c.id}
                    className={`border-b border-line/50 ${
                      unviewed ? "border-l-2 border-l-caution bg-caution/5" : ""
                    }`}
                  >
                    <td className={`px-4 py-3 ${unviewed ? "font-semibold" : "font-medium"}`}>
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
                              : unviewed
                                ? "rounded-full bg-caution/15 px-2 py-0.5 text-caution"
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
                      <ArchiveCheckButton
                        checkId={c.id}
                        archived={statusFilter === "archived"}
                      />
                      {canSeeAnalytics(profile) && <DeleteCheckButton checkId={c.id} label={c.label} />}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {(checks ?? []).length > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-sm">
            {page > 1 ? (
              <Link href={href({ page: String(page - 1) })} className="underline">
                ← Previous
              </Link>
            ) : (
              <span className="text-ink/30">← Previous</span>
            )}
            <span className="font-mono text-xs text-ink/60">
              Page {page} of {totalPages} · {totalCount ?? 0} checks
            </span>
            {page < totalPages ? (
              <Link href={href({ page: String(page + 1) })} className="underline">
                Next →
              </Link>
            ) : (
              <span className="text-ink/30">Next →</span>
            )}
          </div>
          <PageSizeSelect value={pageSize} baseHref={href({})} />
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
