"use client";

import { useTransition } from "react";
import { assignCheck } from "@/app/actions/assign";

export function AssignSelect({
  checkId,
  members,
  assignedTo,
}: {
  checkId: string;
  members: { user_id: string; full_name: string }[];
  assignedTo: string | null;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <label className="flex items-center gap-2 text-sm text-ink/70">
      Reviewer
      <select
        value={assignedTo ?? ""}
        disabled={pending}
        onChange={(e) =>
          startTransition(async () => {
            await assignCheck(checkId, e.target.value || null);
          })
        }
        className="rounded border border-line bg-card px-2 py-1 text-sm"
      >
        <option value="">Unassigned</option>
        {members.map((m) => (
          <option key={m.user_id} value={m.user_id}>
            {m.full_name}
          </option>
        ))}
      </select>
    </label>
  );
}
