import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { AppShell } from "@/app/components/AppShell";
import { CheckProgress } from "./CheckProgress";
import { FindingCard, Badge, type FindingRow } from "./FindingCard";
import { ReviewFooter } from "./ReviewFooter";
import { CorrectionLetter } from "./CorrectionLetter";
import { InfoTip } from "@/app/components/InfoTip";
import { SEVERITY_DEF } from "@/lib/severity";
import { AssignSelect } from "./AssignSelect";
import { AiRating } from "@/app/components/AiRating";
import { BoundRightStamp } from "@/app/components/brand";

const SEVERITY_ORDER = { critical: 0, moderate: 1, minor: 2 } as const;

export default async function CheckPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, agency, profile } = await requireProfile();

  const { data: check } = await supabase
    .from("checks")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!check) notFound();

  const inProgress = ["queued", "extracting", "comparing"].includes(check.status);
  const scanned = check.doc_a_scanned || check.doc_b_scanned;

  const { data: members } = await supabase
    .from("profiles")
    .select("user_id, full_name")
    .order("full_name");
  const { data: nextUnreviewed } = await supabase
    .from("checks")
    .select("id")
    .eq("status", "ready_for_review")
    .is("archived_at", null)
    .neq("id", check.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return (
    <AppShell agency={agency} profile={profile} active="/checks">
      <div className="mx-auto max-w-2xl">
        {/* Report header (spec 4.3.1): stamp sits beside the title once reviewed */}
        <div className="flex items-start justify-between gap-4">
          <h1 className="mb-1 text-2xl font-semibold">{check.label}</h1>
          {check.status === "reviewed" && (
            <BoundRightStamp reviewedAt={check.reviewed_at ?? new Date()} />
          )}
        </div>
        <p className="text-sm text-ink/60">
          {check.policy_type} ·{" "}
          {new Date(check.created_at).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </p>
        <p className="mt-2 text-xs text-ink/50">
          BoundRight is a review assistant and AI can make mistakes. It does
          not provide insurance advice, and final determination of coverage
          accuracy is the responsibility of the licensed agent.
        </p>
        {check.model_version && (
          <details className="mb-3 mt-1">
            <summary className="inline-flex cursor-pointer items-center gap-1 font-mono text-xs text-ink/50 hover:text-ink">
              ✦ How AI checked this document
            </summary>
            <div className="mt-2 max-w-md rounded-lg border border-line bg-card p-4 text-xs leading-relaxed text-ink/70">
              <p>
                Extraction and comparison ran on{" "}
                <span className="font-mono text-ink">{check.model_version}</span>{" "}
                using prompt versions{" "}
                <span className="font-mono text-ink">{check.prompt_version}</span>.
                Both are recorded on every check so a report can always say
                exactly which AI produced it.
              </p>
              <p className="mt-2">
                AI can make mistakes. Review and edit before sending.
              </p>
              <Link href="/ai" className="mt-2 inline-block underline">
                How BoundRight uses AI
              </Link>
            </div>
          </details>
        )}
        {check.status === "ready_for_review" && (
          <div className="mb-6">
            <AssignSelect
              checkId={check.id}
              members={members ?? []}
              assignedTo={check.assigned_to}
            />
          </div>
        )}

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
          <>
            {scanned && (
              <div className="mb-6 rounded-lg border border-caution/50 bg-caution/10 p-4 text-sm">
                One or more documents were scanned images. Extraction
                confidence is reduced. Verify findings against the source
                documents.
              </div>
            )}
            <ReportBody
              checkId={check.id}
              status={check.status}
              correctionLetter={check.correction_letter}
              nextUnreviewedId={nextUnreviewed?.id ?? null}
            />
          </>
        )}
      </div>
    </AppShell>
  );
}

async function ReportBody({
  checkId,
  status,
  correctionLetter,
  nextUnreviewedId,
}: {
  checkId: string;
  status: string;
  correctionLetter: string | null;
  nextUnreviewedId: string | null;
}) {
  const { supabase } = await requireProfile();
  const { data } = await supabase
    .from("findings")
    .select("*")
    .eq("check_id", checkId)
    .order("created_at", { ascending: true });

  const findings = (data ?? []) as FindingRow[];
  const matches = findings.filter((f) => f.status === "match");
  const issues = findings
    .filter((f) => f.status !== "match")
    .sort(
      (a, b) =>
        (SEVERITY_ORDER[a.severity as keyof typeof SEVERITY_ORDER] ?? 3) -
        (SEVERITY_ORDER[b.severity as keyof typeof SEVERITY_ORDER] ?? 3)
    );

  const bySeverity = (sev: string) => issues.filter((f) => f.severity === sev);
  const criticalsRemaining = bySeverity("critical").filter(
    (f) => !f.reviewer_action
  ).length;

  return (
    <div className="space-y-8 pb-24">
      {/* Summary strip (spec 4.3.2) */}
      <div className="flex flex-wrap gap-2">
        <Badge tone="flag">{bySeverity("critical").length} Critical</Badge>
        <Badge tone="caution">{bySeverity("moderate").length} Moderate</Badge>
        <Badge tone="muted">{bySeverity("minor").length} Minor</Badge>
        <Badge tone="verify">{matches.length} Matches</Badge>
        <InfoTip label="What the severities mean">
          <span className="block">
            <strong className="text-flag">Critical</strong> — {SEVERITY_DEF.critical}
          </span>
          <span className="mt-2 block">
            <strong className="text-caution">Moderate</strong> — {SEVERITY_DEF.moderate}
          </span>
          <span className="mt-2 block">
            <strong>Minor</strong> — {SEVERITY_DEF.minor}
          </span>
          <span className="mt-2 block">
            <strong>Confidence</strong> — how sure the extraction is. Low
            means verify against the source document.
          </span>
        </InfoTip>
      </div>

      {/* Findings grouped by severity (spec 4.3.3) */}
      {(["critical", "moderate", "minor"] as const).map((sev) => {
        const group = bySeverity(sev);
        if (group.length === 0) return null;
        return (
          <section key={sev}>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink/60">
              {sev} findings
              <InfoTip label={`What counts as ${sev}`}>{SEVERITY_DEF[sev]}</InfoTip>
            </h2>
            <ul className="space-y-4">
              {group.map((f) => (
                <FindingCard key={f.id} finding={f} />
              ))}
            </ul>
          </section>
        );
      })}

      {issues.length === 0 && (
        <div className="rounded-lg border border-verify/40 bg-card p-8 text-center">
          <Badge tone="verify">No discrepancies</Badge>
          <p className="mt-4 text-ink/80">
            Every extracted field matched. Skim the matches below, then mark
            the check reviewed for your file.
          </p>
        </div>
      )}

      {status === "reviewed" && issues.some((f) => f.reviewer_action === "confirmed") && (
        <CorrectionLetter checkId={checkId} initialLetter={correctionLetter} />
      )}

      {/* Matches, collapsed by default (spec 4.3.4) */}
      <details className="rounded-lg border border-line bg-card p-4">
        <summary className="cursor-pointer font-semibold">
          {matches.length} fields matched · show all
        </summary>
        <ul className="mt-3 divide-y divide-line/60">
          {matches.map((f) => (
            <li key={f.id} className="flex items-baseline justify-between gap-4 py-2 font-mono text-sm">
              <span>{f.field_name}</span>
              <span className="text-right text-verify">{f.expected_value}</span>
            </li>
          ))}
        </ul>
      </details>

      <AiRating target="report" checkId={checkId} label="Rate the AI extraction on this check" />

      {/* Footer actions (spec 4.3.5) */}
      <ReviewFooter
        checkId={checkId}
        status={status}
        criticalsRemaining={criticalsRemaining}
        nextUnreviewedId={nextUnreviewedId}
      />
    </div>
  );
}
