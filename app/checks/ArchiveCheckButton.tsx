"use client";

import { useState, useTransition } from "react";
import { track } from "@/lib/analytics";
import { setCheckArchived } from "@/app/actions/manage-checks";

export function ArchiveCheckButton({
  checkId,
  archived,
}: {
  checkId: string;
  archived: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  // Restore is instantly reversible; only archiving asks first.
  if (archived) {
    return (
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await setCheckArchived(checkId, false);
            track("check_restored");
          })
        }
        className="text-sm underline disabled:opacity-50"
      >
        {pending ? "…" : "Restore"}
      </button>
    );
  }
  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className="text-sm underline">
        Archive
      </button>
    );
  }
  return (
    <span className="inline-flex items-center gap-2 text-sm">
      <span className="text-ink/70">
        Move to Archived? Metrics keep counting it; restore anytime.
      </span>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await setCheckArchived(checkId, true);
            track("check_archived");
            setConfirming(false);
          })
        }
        className="font-semibold underline disabled:opacity-50"
      >
        {pending ? "…" : "Yes, archive"}
      </button>
      <button type="button" onClick={() => setConfirming(false)} className="underline">
        Cancel
      </button>
    </span>
  );
}
