import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { SEVERITY_DEF, STATUS_DEF } from "@/lib/severity";
import { HoverTip } from "@/app/components/InfoTip";
import { canSeeAnalytics } from "@/lib/roles";
import { cookies } from "next/headers";
import { PageSizeSelect } from "./PageSizeSelect";
import { FiltersBar } from "./FiltersBar";
import { AppShell } from "@/app/components/AppShell";
import { DeleteCheckButton } from "./DeleteCheckButton";
import { ArchiveCheckButton } from "./ArchiveCheckButton";
import { resolveRange } from "@/lib/stats";

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
  searchParams: Promise<{
    q?: string;
    status?: string;
    type?: string;
    sort?: string;
    dir?: string;
    page?: string;
    range?: string;
    from?: string;
    to?: string;
  }>;
}) {
  const {
    q,
    status: statusFilter = "all",
    type: typeFilter = "all",
    sort = "date",
    dir = "desc",
    page: pageParam = "1",
    range,
    from,
    to,
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
  // Date range: same presets as the dashboard; default is all time.
  if (range || from) {
    const window = resolveRange({ range, from, to });
    query = query
      .gte("created_at", window.from.toISOString())
      .lt("created_at", window.to.toISOString());
  }
  const { data: checks, count: totalCount } = await query;

  const href = (over: Record<string, string>) => {
    const p = new URLSearchParams();
    if (q?.trim()) p.set("q", q.trim());
    if (statusFilter !== "all") p.set("status", statusFilter);
    if (typeFilter !== "all") p.set("type", typeFilter);
    if (range) p.set("range", range);
    if (from) p.set("from", from);
    if (to) p.set("to", to);
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

      <FiltersBar
        q={q?.trim() ?? ""}
        status={statusFilter}
        type={typeFilter}
        range={range ?? ""}
        from={from ?? ""}
        to={to ?? ""}
      />

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
                      <HoverTip tip={STATUS_DEF[c.status] ?? c.status}>
                      <span
                        className={`cursor-help font-mono text-xs uppercase tracking-wide ${
                          c.status === "failed"
                            ? "text-flag"
                            : c.status === "reviewed"
                              ? "text-verify"
                              : unviewed
                                ? "rounded-full bg-caution/15 px-2 py-0.5 text-caution"
                                : "text-ink/60"
                        }`}
                      >
                        {["queued", "extracting", "comparing"].includes(c.status) && (
                          <span
                            className="mr-1.5 inline-block h-2 w-2 animate-pulse rounded-full bg-ink/60 align-middle"
                            aria-hidden
                          />
                        )}
                        {STATUS_LABEL[c.status] ?? c.status}
                      </span>
                      </HoverTip>
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
    { n: counts.critical, word: "critical" as const, cls: "border-flag text-flag" },
    { n: counts.moderate, word: "moderate" as const, cls: "border-caution text-caution" },
    { n: counts.minor, word: "minor" as const, cls: "border-line text-ink/60" },
  ].filter((p) => p.n > 0);

  if (pills.length === 0) {
    return (
      <HoverTip tip="Every extracted field matched between the two documents.">
        <span className="inline-block cursor-help rounded-full border border-verify px-2 py-0.5 font-mono text-xs text-verify">
          all matched
        </span>
      </HoverTip>
    );
  }
  return (
    <span className="flex flex-wrap gap-1">
      {pills.map((p) => (
        <HoverTip
          key={p.word}
          tip={`${SEVERITY_DEF[p.word]} Counts every ${p.word} finding on the check, before review decisions.`}
        >
          <span
            className={`inline-block cursor-help whitespace-nowrap rounded-full border px-2 py-0.5 font-mono text-xs ${p.cls}`}
          >
            {p.n} {p.word}
          </span>
        </HoverTip>
      ))}
    </span>
  );
}
