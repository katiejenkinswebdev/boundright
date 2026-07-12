"use server";

import { requireProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildMonthlyReportPdf, computeRangeNumbers } from "@/lib/monthly-report";
import { resolveRange } from "@/lib/stats";

export type MonthlyReportResult =
  | { ok: true; pdfBase64: string; filename: string }
  | { ok: false; message: string };

/** One-page report for whatever window the dashboard filter has selected. */
export async function generateRangeReport(params: {
  range?: string;
  from?: string;
  to?: string;
}): Promise<MonthlyReportResult> {
  const { supabase, agency } = await requireProfile();
  const range = resolveRange(params);

  const numbers = await computeRangeNumbers(
    supabase,
    agency,
    range.from,
    range.to,
    range.label
  );
  const pdf = await buildMonthlyReportPdf(agency.name, numbers);

  const admin = createAdminClient();
  if (admin) {
    await admin.from("events").insert({
      agency_id: agency.id,
      event_name: "range_report_generated",
      metadata: { label: range.label, from: range.from.toISOString(), to: range.to.toISOString() },
    });
  }

  return {
    ok: true,
    pdfBase64: Buffer.from(pdf).toString("base64"),
    filename: `BoundRight Report - ${numbers.periodDates}.pdf`,
  };
}
