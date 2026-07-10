import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { CheckProgress } from "./CheckProgress";

const SEVERITY_ORDER = { critical: 0, moderate: 1, minor: 2 } as const;

export default async function CheckPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase } = await requireProfile();

  const { data: check } = await supabase
    .from("checks")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!check) notFound();

  const inProgress = ["queued", "extracting", "comparing"].includes(check.status);

  return (
    <main className="mx-auto w-full max-w-[1100px] flex-1 px-6 py-8">
      <header className="mb-8 flex items-center justify-between">
        <Link href="/dashboard" className="text-xl font-semibold tracking-tight">
          Bound<span className="text-verify">Right</span>
        </Link>
        <Link href="/checks/new" className="text-sm underline">
          New check
        </Link>
      </header>

      <div className="mx-auto max-w-2xl">
        <h1 className="mb-1 text-2xl font-semibold">{check.label}</h1>
        <p className="mb-8 text-sm text-ink/60">
          {check.policy_type} ·{" "}
          {new Date(check.created_at).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </p>

        {inProgress || check.status === "failed" ? (
          <CheckProgress
            checkId={check.id}
            initial={{
              status: check.status,
              failure_reason: check.failure_reason,
              label: check.label,
            }}
          />
        ) : (
          <ReadyView checkId={check.id} />
        )}
      </div>
    </main>
  );
}

/**
 * Minimal findings summary — the full report review screen (confirm/dismiss,
 * matches collapse, export) lands in Phase 3.
 */
async function ReadyView({ checkId }: { checkId: string }) {
  const { supabase } = await requireProfile();
  const { data: findings } = await supabase
    .from("findings")
    .select("*")
    .eq("check_id", checkId);

  const rows = findings ?? [];
  const matches = rows.filter((f) => f.status === "match");
  const issues = rows
    .filter((f) => f.status !== "match")
    .sort(
      (a, b) =>
        (SEVERITY_ORDER[a.severity as keyof typeof SEVERITY_ORDER] ?? 3) -
        (SEVERITY_ORDER[b.severity as keyof typeof SEVERITY_ORDER] ?? 3)
    );
  const count = (sev: string) => issues.filter((f) => f.severity === sev).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <SummaryChip tone="flag" label={`${count("critical")} Critical`} />
        <SummaryChip tone="caution" label={`${count("moderate")} Moderate`} />
        <SummaryChip tone="ink" label={`${count("minor")} Minor`} />
        <SummaryChip tone="verify" label={`${matches.length} Matches`} />
      </div>

      <ul className="space-y-3">
        {issues.map((f) => (
          <li key={f.id} className="rounded-lg border border-line bg-card p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold">{f.field_name}</span>
              <span
                className={`inline-block -rotate-2 rounded border-2 px-2 py-0.5 font-mono text-xs font-medium uppercase tracking-wider ${
                  f.severity === "critical"
                    ? "border-flag text-flag"
                    : f.severity === "moderate"
                      ? "border-caution text-caution"
                      : "border-line text-ink/60"
                }`}
              >
                {f.severity}
              </span>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-wide text-ink/50">Proposal says</p>
                <p className="font-mono text-sm">{f.expected_value ?? "Not found"}</p>
                {f.doc_a_page && (
                  <p className="mt-1 font-mono text-xs text-ink/50">Proposal p. {f.doc_a_page}</p>
                )}
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-ink/50">Policy says</p>
                <p className="font-mono text-sm">{f.found_value ?? "Not found"}</p>
                {f.doc_b_page && (
                  <p className="mt-1 font-mono text-xs text-ink/50">Policy p. {f.doc_b_page}</p>
                )}
              </div>
            </div>
            {f.confidence === "low" && (
              <p className="mt-2 text-xs text-caution">
                Low extraction confidence — verify against source.
              </p>
            )}
          </li>
        ))}
      </ul>

      <details className="rounded-lg border border-line bg-card p-4">
        <summary className="cursor-pointer font-semibold">
          {matches.length} fields matched — show all
        </summary>
        <ul className="mt-3 space-y-1">
          {matches.map((f) => (
            <li key={f.id} className="flex justify-between font-mono text-sm">
              <span>{f.field_name}</span>
              <span className="text-verify">{f.expected_value}</span>
            </li>
          ))}
        </ul>
      </details>

      <p className="text-sm text-ink/60">
        BoundRight is a review assistant. It does not provide insurance advice,
        and final determination of coverage accuracy is the responsibility of
        the licensed agent. Reviewer confirm/dismiss and PDF export arrive in
        the next build phase.
      </p>
    </div>
  );
}

function SummaryChip({ tone, label }: { tone: "flag" | "caution" | "verify" | "ink"; label: string }) {
  const cls = {
    flag: "border-flag text-flag",
    caution: "border-caution text-caution",
    verify: "border-verify text-verify",
    ink: "border-line text-ink/70",
  }[tone];
  return (
    <span
      className={`inline-block -rotate-1 rounded border-2 px-3 py-1 font-mono text-sm font-medium uppercase tracking-wider ${cls}`}
    >
      {label}
    </span>
  );
}
