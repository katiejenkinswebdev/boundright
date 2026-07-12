"use client";

import { useState, useTransition } from "react";
import { saveAgencyLetterGuidance } from "@/app/actions/admin";

/** This client's correction-letter guidance, edited in place. */
export function GuidanceForm({ agencyId, value }: { agencyId: string; value: string }) {
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  return (
    <form
      action={(fd: FormData) =>
        startTransition(async () => {
          await saveAgencyLetterGuidance(agencyId, fd);
          setSaved(true);
        })
      }
    >
      <textarea
        name="guidance"
        defaultValue={value}
        rows={3}
        maxLength={4000}
        placeholder="Instructions that only shape this client's correction letters. Clear and save to return to default."
        className="w-full rounded border border-line bg-paper px-3 py-2 font-mono text-sm"
        onChange={() => setSaved(false)}
      />
      <div className="mt-2 flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded border border-ink px-4 py-1.5 text-sm font-semibold hover:bg-ink hover:text-paper disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save letter guidance"}
        </button>
        {saved && <span className="text-sm text-verify">Saved.</span>}
      </div>
    </form>
  );
}
