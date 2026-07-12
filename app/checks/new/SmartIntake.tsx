"use client";

import { useState } from "react";
import Link from "next/link";
import {
  createIntakeUploads,
  classifyIntake,
  runIntakePairs,
} from "@/app/actions/intake";
import type { ClassifiedDoc, ProposedPair } from "@/lib/intake";
import { primaryButtonClass } from "@/app/components/ui";
import { AiRating } from "@/app/components/AiRating";
import { HoverTip } from "@/app/components/InfoTip";
import { track } from "@/lib/analytics";

type Phase = "drop" | "uploading" | "classifying" | "confirm" | "starting" | "done";

const TYPE_LABEL: Record<string, string> = {
  issuance: "Issuance",
  renewal: "Renewal",
  coi: "Certificate",
};

export function SmartIntake() {
  const [phase, setPhase] = useState<Phase>("drop");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pairs, setPairs] = useState<ProposedPair[]>([]);
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [orphans, setOrphans] = useState<ClassifiedDoc[]>([]);
  const [failures, setFailures] = useState<{ filename: string; reason: string }[]>([]);
  const [checkIds, setCheckIds] = useState<string[]>([]);

  async function classify(selected: File[]) {
    setError(null);
    setPhase("uploading");
    try {
      const created = await createIntakeUploads(selected.map((f) => f.name));
      if (!created.ok) {
        setError(created.message);
        setPhase("drop");
        return;
      }
      const results = await Promise.all(
        created.uploads.map(({ url }, i) =>
          fetch(url, {
            method: "PUT",
            headers: { "Content-Type": "application/pdf" },
            body: selected[i],
          })
        )
      );
      if (results.some((r) => !r.ok)) {
        setError("An upload didn't finish. Try again.");
        setPhase("drop");
        return;
      }
      setPhase("classifying");
      const classified = await classifyIntake(
        created.uploads.map(({ path }, i) => ({ path, filename: selected[i].name }))
      );
      if (!classified.ok) {
        setError(classified.message);
        setPhase("drop");
        return;
      }
      track("smart_intake_classified", {
        files: selected.length,
        pairs: classified.pairs.length,
        orphans: classified.orphans.length,
      });
      setPairs(classified.pairs);
      setOrphans(classified.orphans);
      setFailures(classified.failures);
      setExcluded(new Set());
      setPhase("confirm");
    } catch {
      setError("Something went wrong. Try again.");
      setPhase("drop");
    }
  }

  async function runAll() {
    setError(null);
    setPhase("starting");
    const chosen = pairs.filter((_, i) => !excluded.has(i));
    const discard = [
      ...pairs.filter((_, i) => excluded.has(i)).flatMap((p) => [p.a.path, p.b.path]),
      ...orphans.map((o) => o.path),
    ];
    const result = await runIntakePairs(
      chosen.map((p) => ({
        aPath: p.a.path,
        bPath: p.b.path,
        aFilename: p.a.filename,
        bFilename: p.b.filename,
        label: p.label,
        checkType: p.checkType,
        policyType: p.policyType,
      })),
      discard
    );
    if (!result.ok) {
      setError(result.message);
      setPhase("confirm");
      return;
    }
    track("smart_intake_run", { checks: result.checkIds.length });
    setCheckIds(result.checkIds);
    setPhase("done");
  }

  if (phase === "done") {
    return (
      <div className="rounded-lg border border-verify/40 bg-card p-8 text-center">
        <p className="text-lg font-semibold">
          {checkIds.length} check{checkIds.length === 1 ? "" : "s"} running.
        </p>
        <p className="mt-2 text-ink/70">
          You&apos;ll be emailed as each report is ready.
        </p>
        <Link
          href="/checks"
          className="mt-6 inline-block rounded bg-ink px-6 py-3 font-semibold text-paper hover:bg-ink/90"
        >
          Watch progress in Checks
        </Link>
        <div className="mt-5">
          <AiRating target="smart_intake" label="Rate the classification and pairing" />
        </div>
      </div>
    );
  }

  if (phase === "confirm") {
    const chosenCount = pairs.length - excluded.size;
    return (
      <div className="space-y-5">
        <p className="text-ink/80">
          BoundRight classified your documents and proposes these pairs. AI
          can make mistakes, so check each one.
          <strong> Nothing runs until you confirm.</strong> Uncheck any pair
          that&apos;s wrong.
        </p>

        {pairs.map((p, i) => (
          <label
            key={i}
            className={`flex cursor-pointer items-start gap-3 rounded-lg border bg-card p-4 ${
              excluded.has(i) ? "border-line opacity-50" : "border-line"
            }`}
          >
            <input
              type="checkbox"
              checked={!excluded.has(i)}
              onChange={() =>
                setExcluded((prev) => {
                  const next = new Set(prev);
                  if (next.has(i)) next.delete(i);
                  else next.add(i);
                  return next;
                })
              }
              className="mt-1"
            />
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{p.label}</span>
                <span className="inline-flex items-center rounded border border-line px-2.5 py-1 font-mono text-xs uppercase leading-none text-ink/60">
                  {TYPE_LABEL[p.checkType]}
                </span>
                <HoverTip tip="How sure the AI is that these two documents belong together and what type they are. Nothing runs until you confirm the pair.">
                  <span
                    className={`inline-flex cursor-help items-center rounded border px-2.5 py-1 font-mono text-xs uppercase leading-none ${
                      p.confidence === "high"
                        ? "border-verify text-verify"
                        : p.confidence === "medium"
                          ? "border-caution text-caution"
                          : "border-flag text-flag"
                    }`}
                  >
                    ✦ {p.confidence} confidence
                  </span>
                </HoverTip>
              </span>
              <span className="mt-1 block font-mono text-xs text-ink/60">
                A: {p.a.filename} ({p.a.document_type}) · B: {p.b.filename} ({p.b.document_type})
              </span>
            </span>
          </label>
        ))}

        {orphans.length > 0 && (
          <div className="rounded-lg border border-caution/50 bg-caution/5 p-4 text-sm">
            <p className="font-semibold">
              {orphans.length} document{orphans.length === 1 ? " has" : "s have"} no partner
            </p>
            <ul className="mt-1 font-mono text-xs text-ink/70">
              {orphans.map((o) => (
                <li key={o.path}>
                  {o.filename} · {o.document_type}
                  {o.named_insured ? ` · ${o.named_insured}` : ""}
                </li>
              ))}
            </ul>
            <p className="mt-1 text-ink/60">
              These are discarded when you run (they&apos;re deleted, never
              kept). Pair them manually if they belong together.
            </p>
          </div>
        )}

        {failures.length > 0 && (
          <div className="rounded-lg border border-flag/40 bg-card p-4 text-sm">
            {failures.map((f2) => (
              <p key={f2.filename}>
                <span className="font-mono">{f2.filename}</span>: {f2.reason}
              </p>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={chosenCount === 0}
            onClick={runAll}
            className={primaryButtonClass + " w-auto"}
          >
            Run {chosenCount} check{chosenCount === 1 ? "" : "s"}
          </button>
          <span className="text-sm text-ink/60">
            Each pair counts as 1 check against your monthly allowance.
          </span>
          <button type="button" onClick={() => setPhase("drop")} className="text-sm underline">
            Start over
          </button>
        </div>
        {error && (
          <p role="alert" className="text-flag text-sm">
            {error}
          </p>
        )}
      </div>
    );
  }

  const busy = phase === "uploading" || phase === "classifying" || phase === "starting";
  return (
    <div className="space-y-4">
      <label
        className={`flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-line bg-card p-8 text-center hover:border-ink ${
          busy ? "pointer-events-none opacity-60" : ""
        }`}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const dropped = Array.from(e.dataTransfer.files).filter((f) =>
            f.name.toLowerCase().endsWith(".pdf")
          );
          if (dropped.length) {
            setFiles(dropped);
            classify(dropped);
          }
        }}
      >
        <span className="text-lg font-semibold">
          {busy
            ? phase === "uploading"
              ? `Uploading ${files.length} files…`
              : phase === "classifying"
                ? "Reading and pairing your documents…"
                : "Starting checks…"
            : "Drop the whole pile here"}
        </span>
        <span className="mt-2 max-w-md text-ink/60">
          Proposals, policies, renewals, certificates, in any order, unlabeled.
          BoundRight identifies each one, proposes the pairs, and you confirm
          before anything runs.
        </span>
        <input
          type="file"
          accept=".pdf,application/pdf"
          multiple
          className="sr-only"
          onChange={(e) => {
            const chosen = Array.from(e.target.files ?? []);
            if (chosen.length) {
              setFiles(chosen);
              classify(chosen);
            }
          }}
        />
      </label>
      <p className="text-sm text-ink/60">
        Up to 30 PDFs. Unpaired files are deleted, and staged files that never
        run are removed automatically within 48 hours.{" "}
        <Link href="/checks/new?classic=1" className="underline">
          Prefer the two-document flow?
        </Link>
      </p>
      {error && (
        <p role="alert" className="text-flag text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
