import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildMonthlyReportPdf, computeMonthlyNumbers } from "@/lib/monthly-report";
import { isAuthorizedCron } from "../route-helpers";

/**
 * 1st of each month: generate the prior month's ROI report for every agency,
 * snapshot it, and email it to the account owner.
 */
export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "not configured" }, { status: 503 });

  const now = new Date();
  const priorMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));

  const { data: agencies } = await admin
    .from("agencies")
    .select("id, name, manual_check_minutes, avg_account_premium");

  let sent = 0;
  for (const agency of agencies ?? []) {
    try {
      const numbers = await computeMonthlyNumbers(admin, agency, priorMonth);
      const pdf = await buildMonthlyReportPdf(agency.name, numbers);

      const { data: owner } = await admin
        .from("profiles")
        .select("user_id")
        .eq("agency_id", agency.id)
        .eq("role", "owner")
        .limit(1)
        .maybeSingle();
      let emailed = false;
      if (owner && process.env.RESEND_API_KEY) {
        const { data: userData } = await admin.auth.admin.getUserById(owner.user_id);
        const email = userData?.user?.email;
        if (email) {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: "BoundRight <notifications@boundright.app>",
              to: [email],
              subject: `${agency.name} · policy check ROI report for ${numbers.monthLabel}`,
              html: `<p>Your ${numbers.monthLabel} report is attached: ${numbers.checksRun} checks, ${numbers.findingsConfirmed} confirmed discrepancies, ~$${numbers.exposureFlagged.toLocaleString()} exposure flagged.</p><p>Share it with your principal. It's the receipt for the work your team did.</p>`,
              attachments: [
                {
                  filename: `BoundRight ROI ${numbers.monthLabel}.pdf`,
                  content: Buffer.from(pdf).toString("base64"),
                },
              ],
            }),
          });
          emailed = true;
          sent++;
        }
      }

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
          emailed_at: emailed ? new Date().toISOString() : null,
        },
        { onConflict: "agency_id,month" }
      );
    } catch (err) {
      console.error(`monthly report failed for agency ${agency.id}:`, err);
    }
  }

  return NextResponse.json({ agencies: agencies?.length ?? 0, emailed: sent });
}
