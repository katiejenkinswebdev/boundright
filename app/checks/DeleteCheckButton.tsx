"use client";

import { useState, useTransition } from "react";
import { track } from "@/lib/analytics";
import { deleteCheck } from "@/app/actions/manage-checks";

export function DeleteCheckButton({ checkId, label }: { checkId: string; label: string }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-sm text-flag underline"
      >
        Delete
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-2 text-sm">
      <span className="text-ink/70">
        Delete “{label}”? Its findings are removed and your dashboard stats
        adjust.
      </span>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await deleteCheck(checkId);
            track("check_deleted");
          })
        }
        className="font-semibold text-flag underline disabled:opacity-50"
      >
        {pending ? "Deleting…" : "Yes, delete"}
      </button>
      <button type="button" onClick={() => setConfirming(false)} className="underline">
        Cancel
      </button>
    </span>
  );
}
