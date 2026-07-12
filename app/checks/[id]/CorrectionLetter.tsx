"use client";

import { useState, useTransition } from "react";
import { generateCorrectionLetter } from "@/app/actions/letter";

export function CorrectionLetter({
  checkId,
  initialLetter,
}: {
  checkId: string;
  initialLetter: string | null;
}) {
  const [letter, setLetter] = useState(initialLetter ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  return (
    <section className="rounded-lg border border-line bg-card p-6">
      <h2 className="font-semibold">Correction request <span className="ml-1 font-mono text-xs font-normal text-ink/50" title="AI-drafted; you edit and send it">✦ AI draft</span></h2>
      <p className="mt-1 text-sm text-ink/70">
        Drafts a request to the carrier from your confirmed findings:
        enumerated discrepancies, correction effective inception, written
        confirmation requested. AI can make mistakes. Review and edit before
        sending; it goes out under your name.
      </p>

      {letter ? (
        <>
          <textarea
            value={letter}
            onChange={(e) => setLetter(e.target.value)}
            rows={14}
            className="mt-4 w-full rounded border border-line bg-paper p-3 font-mono text-sm"
          />
          <div className="mt-3 flex gap-3">
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(letter);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="rounded bg-ink px-4 py-2 text-sm font-semibold text-paper hover:bg-ink/90"
            >
              {copied ? "Copied" : "Copy letter"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setError(null);
                startTransition(async () => {
                  const result = await generateCorrectionLetter(checkId);
                  if (result.ok) setLetter(result.letter);
                  else setError(result.message);
                });
              }}
              className="rounded border border-ink px-4 py-2 text-sm font-semibold hover:bg-ink hover:text-paper disabled:opacity-50"
            >
              {pending ? "Redrafting…" : "Redraft"}
            </button>
          </div>
        </>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const result = await generateCorrectionLetter(checkId);
              if (result.ok) setLetter(result.letter);
              else setError(result.message);
            });
          }}
          className="mt-4 rounded bg-ink px-5 py-2.5 font-semibold text-paper hover:bg-ink/90 disabled:opacity-50"
        >
          {pending ? "Drafting…" : "Draft correction request"}
        </button>
      )}
      {error && (
        <p role="alert" className="mt-2 text-flag text-sm">
          {error}
        </p>
      )}
    </section>
  );
}
