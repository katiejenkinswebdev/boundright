"use client";

import { useState, useTransition } from "react";
import { track } from "@/lib/analytics";
import { generateRangeReport } from "@/app/actions/monthly-report";

/** Exports the currently filtered window as a one-page PDF. */
export function MonthlyReportButton({
  rangeParams,
}: {
  rangeParams: { range?: string; from?: string; to?: string };
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await generateRangeReport(rangeParams);
            track("period_report_generated");
            if (!result.ok) {
              setError(result.message);
              return;
            }
            const bytes = Uint8Array.from(atob(result.pdfBase64), (c) => c.charCodeAt(0));
            const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
            const a = document.createElement("a");
            a.href = url;
            a.download = result.filename;
            a.click();
            URL.revokeObjectURL(url);
          });
        }}
        className="rounded border border-ink px-4 py-2 text-sm font-semibold hover:bg-ink hover:text-paper disabled:opacity-50"
      >
        {pending ? "Exporting…" : "Export report (PDF)"}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-flag text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
