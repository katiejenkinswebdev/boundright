"use client";

import { useState, useTransition } from "react";
import { savePlatformLetterPrompt } from "@/app/actions/admin";

/**
 * The platform correction-request prompt: the exact instructions used for
 * every client's letters. Blank reverts to the built-in versioned prompt
 * (shown as the starting text). Per-client fine-tuning is appended from
 * each client's ops page.
 */
export function PlatformPromptForm({
  value,
  builtIn,
}: {
  value: string;
  builtIn: string;
}) {
  const [draft, setDraft] = useState(value || builtIn);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const isBuiltIn = !value;

  return (
    <form
      action={(fd: FormData) =>
        startTransition(async () => {
          await savePlatformLetterPrompt(fd);
          setSaved(true);
        })
      }
    >
      <p className="mb-2 text-sm text-ink/70">
        Used for every client&apos;s correction requests. Each client&apos;s
        own fine-tuning (set on their client page) is appended to this when a
        letter is drafted.{" "}
        <span className="font-mono text-xs text-ink/50">
          {isBuiltIn ? "currently: built-in prompt (letter_v2)" : "currently: customized"}
        </span>
      </p>
      <textarea
        name="prompt"
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          setSaved(false);
        }}
        rows={12}
        maxLength={12000}
        className="w-full rounded border border-line bg-paper px-3 py-2 font-mono text-xs leading-relaxed"
      />
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-ink px-4 py-2 text-sm font-semibold text-paper hover:bg-ink/90 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save platform prompt"}
        </button>
        <button
          type="button"
          onClick={() => {
            setDraft(builtIn);
            setSaved(false);
          }}
          className="text-sm underline"
        >
          Restore built-in text
        </button>
        <span className="text-xs text-ink/50">
          Saving text identical to the built-in keeps you on the maintained
          version. Test with a stub letter after changes.
        </span>
        {saved && <span className="text-sm text-verify">Saved.</span>}
      </div>
    </form>
  );
}
