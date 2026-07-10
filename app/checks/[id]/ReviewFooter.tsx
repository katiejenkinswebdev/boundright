"use client";

import { useState, useTransition } from "react";
import { markReviewed } from "@/app/actions/review";
import { BoundRightStamp } from "@/app/components/brand";

export function ReviewFooter({
  checkId,
  status,
  reviewedAt,
  criticalsRemaining,
}: {
  checkId: string;
  status: string;
  reviewedAt: string | null;
  criticalsRemaining: number;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const reviewed = status === "reviewed";

  return (
    <div className="sticky bottom-0 -mx-6 border-t border-line bg-paper/95 px-6 py-4 backdrop-blur">
      <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-3">
        {reviewed ? (
          <BoundRightStamp reviewedAt={reviewedAt ?? new Date()} />
        ) : (
          <button
            type="button"
            disabled={pending || criticalsRemaining > 0}
            title={
              criticalsRemaining > 0
                ? `Confirm or dismiss ${criticalsRemaining} critical finding${criticalsRemaining === 1 ? "" : "s"} first`
                : undefined
            }
            onClick={() => {
              setError(null);
              startTransition(async () => {
                const result = await markReviewed(checkId);
                if (!result.ok) setError(result.message);
              });
            }}
            className="rounded bg-ink px-6 py-3 font-semibold text-paper hover:bg-ink/90 disabled:opacity-50"
          >
            {pending ? "Saving…" : "Mark reviewed"}
          </button>
        )}

        {reviewed ? (
          <a
            href={`/api/checks/${checkId}/report`}
            className="rounded bg-ink px-6 py-3 font-semibold text-paper hover:bg-ink/90"
          >
            Export report (PDF)
          </a>
        ) : (
          <span className="text-sm text-ink/60">
            {criticalsRemaining > 0
              ? `${criticalsRemaining} critical finding${criticalsRemaining === 1 ? "" : "s"} awaiting your decision`
              : "Mark reviewed to enable export"}
          </span>
        )}
      </div>
      {error && (
        <p role="alert" className="mx-auto mt-2 max-w-2xl text-flag text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
