"use client";

import { useState, useTransition } from "react";
import { rateAiOutput } from "@/app/actions/ai-feedback";
import { track } from "@/lib/analytics";

/**
 * Thumbs up/down on an AI output. One tap, optional note on a thumbs down.
 * Ratings land in ai_feedback keyed to the check's prompt version, which is
 * what the ops console watches to tune prompts.
 */
export function AiRating({
  target,
  checkId,
  label = "Rate this AI output",
}: {
  target: "letter" | "report" | "smart_intake";
  checkId?: string;
  label?: string;
}) {
  const [state, setState] = useState<"idle" | "noted" | "done">("idle");
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();

  if (state === "done") {
    return (
      <span className="font-mono text-xs text-ink/50">
        Thanks, noted. Ratings tune the AI prompts.
      </span>
    );
  }

  const send = (rating: 1 | -1, withNote?: string) =>
    startTransition(async () => {
      await rateAiOutput({ target, rating, checkId, note: withNote });
      track("ai_rated", { target, rating });
      setState("done");
    });

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span className="font-mono text-xs text-ink/50">{label}</span>
      <button
        type="button"
        disabled={pending}
        aria-label="Good AI output"
        onClick={() => send(1)}
        className="rounded border border-line px-2 py-1 text-xs leading-none hover:border-verify hover:text-verify disabled:opacity-50"
      >
        👍
      </button>
      <button
        type="button"
        disabled={pending}
        aria-label="Poor AI output"
        onClick={() => setState("noted")}
        className="rounded border border-line px-2 py-1 text-xs leading-none hover:border-flag hover:text-flag disabled:opacity-50"
      >
        👎
      </button>
      {state === "noted" && (
        <span className="inline-flex items-center gap-2">
          <input
            autoFocus
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send(-1, note)}
            placeholder="What was wrong? (optional)"
            className="w-52 rounded border border-line bg-paper px-2 py-1 text-xs"
          />
          <button
            type="button"
            disabled={pending}
            onClick={() => send(-1, note)}
            className="rounded border border-line px-2 py-1 text-xs leading-none hover:border-ink"
          >
            Send
          </button>
        </span>
      )}
    </span>
  );
}
