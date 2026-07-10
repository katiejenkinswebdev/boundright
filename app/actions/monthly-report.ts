"use server";

import { requireProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildMonthlyReportPdf, computeMonthlyNumbers } from "@/lib/monthly-report";

export type MonthlyReportResult =
  | { ok: true; pdfBase64: string; filename: string }
  | { ok: false; message: string };

/** Generates the current month's ROI report on demand ("Download"). */
export async function generateMonthlyReport(): Promise<MonthlyReportResult> {
  const { supabase, agency } = await requireProfile();

  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const numbers = await computeMonthlyNumbers(supabase, agency, monthStart);
  const pdf = await buildMonthlyReportPdf(agency.name, numbers);

  // Snapshot for the retention engine (service role: no user insert policy).
  const admin = createAdminClient();
  if (admin) {
    await admin.from("monthly_snapshots").upsert(
      {
        agency_id: agency.id,
        month: numbers.monthDate,
        checks_run: numbers.checksRun,
        findings_confirmed: numbers.findingsConfirmed,
        critical_confirmed: numbers.criticalConfirmed,
        hours_saved: numbers.hoursSaved,
        exposure_flagged: numbers.exposureFlagged,
        report_pdf_generated: true,
      },
      { onConflict: "agency_id,month" }
    );
    await admin.from("events").insert({
      agency_id: agency.id,
      event_name: "monthly_report_generated",
      metadata: { month: numbers.monthDate },
    });
  }

  return {
    ok: true,
    pdfBase64: Buffer.from(pdf).toString("base64"),
    filename: `BoundRight ROI Report - ${numbers.monthLabel}.pdf`,
  };
}
