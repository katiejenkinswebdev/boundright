"use client";

import { useState, useTransition } from "react";
import { setFindingReview } from "@/app/actions/review";

export type FindingRow = {
  id: string;
  doc_a_excerpt?: string | null;
  doc_b_excerpt?: string | null;
  dismiss_reason?: string | null;
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

/**
 * Quiet severity/status badge. Deliberately level and thin-bordered: the
 * rotated stamp gesture is reserved for the BOUND RIGHT confirmation stamp.
 */
export function Badge({
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
      className={`inline-block rounded border px-2 py-0.5 font-mono text-xs font-medium uppercase tracking-wider ${cls}`}
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

  const [dismissing, setDismissing] = useState(false);
  const act = (action: "confirmed" | "dismissed", reason?: string) => {
    setError(null);
    setDismissing(false);
    startTransition(async () => {
      const result = await setFindingReview(finding.id, action, note, reason);
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
          {finding.severity && <Badge tone={severityTone}>{finding.severity}</Badge>}
          {finding.reviewer_action && (
            <Badge tone={finding.reviewer_action === "confirmed" ? "verify" : "muted"}>
              {finding.reviewer_action}
            </Badge>
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
            <SourcePeek label={`Proposal p. ${finding.doc_a_page}`} excerpt={finding.doc_a_excerpt} />
          )}
        </div>
        <div className="rounded border border-line/60 p-3">
          <p className="text-xs uppercase tracking-wide text-ink/50">Policy says</p>
          <p className={`mt-1 font-mono text-sm ${finding.found_value ? "" : "italic text-ink/40"}`}>
            {finding.found_value ?? "Not found"}
          </p>
          {finding.doc_b_page && (
            <SourcePeek label={`Policy p. ${finding.doc_b_page}`} excerpt={finding.doc_b_excerpt} />
          )}
        </div>
      </div>

      {finding.confidence === "low" && (
        <p className="mt-3 text-sm text-caution">
          Low extraction confidence. Verify against source.
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
          onClick={() => setDismissing((v) => !v)}
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

      {dismissing && (
        <div className="mt-3 rounded border border-line bg-paper p-3">
          <p className="mb-2 text-sm font-semibold">Why dismiss? This tunes future checks.</p>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["not_a_discrepancy", "Not a real discrepancy"],
                ["wrong_extraction", "Extracted value is wrong"],
                ["known_intentional", "Known and intentional"],
                ["duplicate", "Duplicate finding"],
                ["other", "Other"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                disabled={pending}
                onClick={() => act("dismissed", value)}
                className="rounded border border-line px-3 py-1.5 text-sm hover:border-ink"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {showNote && (
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => {
            if (finding.reviewer_action) act(finding.reviewer_action);
          }}
          placeholder="Optional note. Saved with your decision and included in the exported report."
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

function SourcePeek({ label, excerpt }: { label: string; excerpt?: string | null }) {
  const [open, setOpen] = useState(false);
  if (!excerpt) {
    return (
      <span className="mt-2 inline-block rounded border border-line px-2 py-0.5 font-mono text-xs text-ink/60">
        {label}
      </span>
    );
  }
  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="rounded border border-line px-2 py-0.5 font-mono text-xs text-ink/60 underline decoration-dotted hover:border-ink"
      >
        {label}
      </button>
      {open && (
        <p className="mt-2 rounded border border-line bg-paper p-2 font-mono text-xs leading-relaxed text-ink/80">
          {excerpt}
        </p>
      )}
    </div>
  );
}
