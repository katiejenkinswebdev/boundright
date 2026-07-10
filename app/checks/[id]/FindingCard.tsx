"use client";

import { useState, useTransition } from "react";
import { setFindingReview } from "@/app/actions/review";

export type FindingRow = {
  id: string;
  field_name: string;
  category: string;
  status: string;
  severity: string | null;
  expected_value: string | null;
  found_value: string | null;
  doc_a_page: number | null;
  doc_b_page: number | null;
  confidence: string;
  reviewer_action: "confirmed" | "dismissed" | null;
  reviewer_note: string | null;
};

export function Stamp({
  tone,
  children,
}: {
  tone: "flag" | "caution" | "verify" | "muted";
  children: React.ReactNode;
}) {
  const cls = {
    flag: "border-flag text-flag",
    caution: "border-caution text-caution",
    verify: "border-verify text-verify",
    muted: "border-line text-ink/60",
  }[tone];
  return (
    <span
      className={`inline-block -rotate-2 rounded border-2 px-2 py-0.5 font-mono text-xs font-medium uppercase tracking-wider ${cls}`}
    >
      {children}
    </span>
  );
}

export function FindingCard({ finding }: { finding: FindingRow }) {
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState(finding.reviewer_note ?? "");
  const [showNote, setShowNote] = useState(!!finding.reviewer_note);
  const [error, setError] = useState<string | null>(null);

  const act = (action: "confirmed" | "dismissed") => {
    setError(null);
    startTransition(async () => {
      const result = await setFindingReview(finding.id, action, note);
      if (!result.ok) setError(result.message);
    });
  };

  const severityTone =
    finding.severity === "critical"
      ? "flag"
      : finding.severity === "moderate"
        ? "caution"
        : "muted";

  return (
    <li className="rounded-lg border border-line bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="font-semibold">{finding.field_name}</span>
          <span className="ml-2 text-xs uppercase tracking-wide text-ink/40">
            {finding.category.replace("_", " ")}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {finding.severity && <Stamp tone={severityTone}>{finding.severity}</Stamp>}
          {finding.reviewer_action && (
            <Stamp tone={finding.reviewer_action === "confirmed" ? "verify" : "muted"}>
              {finding.reviewer_action}
            </Stamp>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="rounded border border-line/60 p-3">
          <p className="text-xs uppercase tracking-wide text-ink/50">Proposal says</p>
          <p className={`mt-1 font-mono text-sm ${finding.expected_value ? "" : "italic text-ink/40"}`}>
            {finding.expected_value ?? "Not found"}
          </p>
          {finding.doc_a_page && (
            <span className="mt-2 inline-block rounded border border-line px-2 py-0.5 font-mono text-xs text-ink/60">
              Proposal p. {finding.doc_a_page}
            </span>
          )}
        </div>
        <div className="rounded border border-line/60 p-3">
          <p className="text-xs uppercase tracking-wide text-ink/50">Policy says</p>
          <p className={`mt-1 font-mono text-sm ${finding.found_value ? "" : "italic text-ink/40"}`}>
            {finding.found_value ?? "Not found"}
          </p>
          {finding.doc_b_page && (
            <span className="mt-2 inline-block rounded border border-line px-2 py-0.5 font-mono text-xs text-ink/60">
              Policy p. {finding.doc_b_page}
            </span>
          )}
        </div>
      </div>

      {finding.confidence === "low" && (
        <p className="mt-3 text-sm text-caution">
          Low extraction confidence — verify against source.
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={() => act("confirmed")}
          className={`rounded px-4 py-2 text-sm font-semibold disabled:opacity-50 ${
            finding.reviewer_action === "confirmed"
              ? "bg-verify text-white"
              : "border border-verify text-verify hover:bg-verify hover:text-white"
          }`}
        >
          Confirm
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => act("dismissed")}
          className={`rounded px-4 py-2 text-sm font-semibold disabled:opacity-50 ${
            finding.reviewer_action === "dismissed"
              ? "bg-ink text-paper"
              : "border border-ink text-ink hover:bg-ink hover:text-paper"
          }`}
        >
          Dismiss
        </button>
        <button
          type="button"
          onClick={() => setShowNote((v) => !v)}
          className="text-sm underline"
        >
          {showNote ? "Hide note" : "Add note"}
        </button>
      </div>

      {showNote && (
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => {
            if (finding.reviewer_action) act(finding.reviewer_action);
          }}
          placeholder="Optional note — saved with your decision, included in the exported report."
          rows={2}
          className="mt-3 w-full rounded border border-line bg-paper px-3 py-2 text-sm"
        />
      )}
      {error && (
        <p role="alert" className="mt-2 text-flag text-sm">
          {error}
        </p>
      )}
    </li>
  );
}
