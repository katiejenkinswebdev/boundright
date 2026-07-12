"use client";

import { useTransition } from "react";
import { setCheckArchived } from "@/app/actions/manage-checks";

export function ArchiveCheckButton({
  checkId,
  archived,
}: {
  checkId: string;
  archived: boolean;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => void (await setCheckArchived(checkId, !archived)))
      }
      className="text-sm underline disabled:opacity-50"
    >
      {pending ? "…" : archived ? "Restore" : "Archive"}
    </button>
  );
}
