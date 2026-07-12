import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { drawBrandFooter, drawBrandStamp, PDF_MARGIN } from "./pdf-brand";
import type { SupabaseClient } from "@supabase/supabase-js";

const INK = rgb(0.106, 0.165, 0.255);
const VERIFY = rgb(0.122, 0.478, 0.361);
const MUTED = rgb(0.45, 0.45, 0.45);

export type MonthlyNumbers = {
  monthLabel: string; // period label: "June 2026" or "the last 3 months"
  monthDate: string; // period start "2026-06-01" (snapshot key for months)
  periodDates: string; // exact dates line: "Jun 1, 2026 to Jun 30, 2026"
  checksRun: number;
  findingsConfirmed: number;
  criticalConfirmed: number;
  hoursSaved: number;
  staffDollars: number;
  exposureFlagged: number;
};

type AgencyNumbers = {
  id: string;
  manual_check_minutes: number;
  avg_account_premium: number;
  csr_hourly_rate?: number;
};

/** Numbers for an arbitrary window; the report generator's engine. */
export async function computeRangeNumbers(
  db: SupabaseClient,
  agency: AgencyNumbers,
  fromDate: Date,
  toDate: Date,
  label: string
): Promise<MonthlyNumbers> {
  const from = fromDate.toISOString();
  const to = toDate.toISOString();
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

  const { data: checks } = await db
    .from("checks")
    .select("id")
    .eq("agency_id", agency.id)
    .in("status", ["ready_for_review", "reviewed"])
    .gte("created_at", from)
    .lt("created_at", to);
  const { data: confirmed } = await db
    .from("findings")
    .select("id, severity")
    .eq("agency_id", agency.id)
    .eq("reviewer_action", "confirmed")
    .neq("status", "match")
    .gte("created_at", from)
    .lt("created_at", to);

  const checksRun = checks?.length ?? 0;
  const findingsConfirmed = confirmed?.length ?? 0;
  const criticalConfirmed = (confirmed ?? []).filter(
    (f: { severity: string | null }) => f.severity === "critical"
  ).length;

  const hoursSaved = (checksRun * agency.manual_check_minutes) / 60;
  return {
    monthLabel: label,
    monthDate: fromDate.toISOString().slice(0, 10),
    periodDates: `${fmt(fromDate)} to ${fmt(new Date(toDate.getTime() - 1))}`,
    checksRun,
    findingsConfirmed,
    criticalConfirmed,
    hoursSaved,
    staffDollars: Math.round(hoursSaved * Number(agency.csr_hourly_rate ?? 0)),
    exposureFlagged: criticalConfirmed * Number(agency.avg_account_premium),
  };
}

/** Calendar-month wrapper used by the monthly cron. */
export async function computeMonthlyNumbers(
  db: SupabaseClient,
  agency: AgencyNumbers,
  monthStart: Date
): Promise<MonthlyNumbers> {
  const monthEnd = new Date(
    Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 1)
  );
  return computeRangeNumbers(
    db,
    agency,
    monthStart,
    monthEnd,
    monthStart.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })
  );
}

function summaryParagraph(n: MonthlyNumbers, agencyName: string): string {
  if (n.checksRun === 0) {
    return `${agencyName} ran no policy checks in ${n.monthLabel}. Every unchecked renewal is an unreviewed E&O exposure. The fastest win next month is checking each renewal as it's issued.`;
  }
  const pieces = [
    `In ${n.monthLabel}, ${agencyName} ran ${n.checksRun} policy check${n.checksRun === 1 ? "" : "s"} through BoundRight`,
    n.findingsConfirmed > 0
      ? `and the team confirmed ${n.findingsConfirmed} discrepanc${n.findingsConfirmed === 1 ? "y" : "ies"} between what was sold and what was issued`
      : `and every compared field matched, clean issuance across the board`,
  ];
  let s = pieces.join(" ") + ".";
  if (n.criticalConfirmed > 0) {
    s += ` ${n.criticalConfirmed} ${n.criticalConfirmed === 1 ? "was" : "were"} critical: limits, forms, or dates that would have surfaced at claim time. Based on the agency's average account premium, that's an estimated $${n.exposureFlagged.toLocaleString()} of exposure caught before the client found it.`;
  }
  s += ` The checks saved an estimated ${n.hoursSaved.toFixed(1)} staff hours of manual line-by-line review.`;
  return s;
}

export async function buildMonthlyReportPdf(
  agencyName: string,
  n: MonthlyNumbers
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const sans = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([612, 792]);
  const M = PDF_MARGIN;
  let y = 792 - M;

  const text = (
    str: string,
    size: number,
    opts: { font?: typeof sans; color?: ReturnType<typeof rgb>; x?: number } = {}
  ) => {
    // naive wrap
    const font = opts.font ?? sans;
    const maxW = 612 - M - (opts.x ?? M);
    const words = str.split(" ");
    let line = "";
    const flush = () => {
      page.drawText(line, { x: opts.x ?? M, y, size, font, color: opts.color ?? INK });
      y -= size + 7;
      line = "";
    };
    for (const w of words) {
      const cand = line ? `${line} ${w}` : w;
      if (font.widthOfTextAtSize(cand, size) > maxW) flush();
      line = line ? `${line} ${w}` : w;
    }
    if (line) flush();
  };

  drawBrandStamp(page, bold, { x: 612 - M - 100, topY: 792 - M + 2 });
  text(agencyName, 18, { font: bold });
  text(`Policy check report · ${n.monthLabel}`, 12, { color: MUTED });
  text(`Period: ${n.periodDates}`, 9, { color: MUTED });
  y -= 12;
  page.drawLine({
    start: { x: M, y },
    end: { x: 612 - M - 125, y },
    thickness: 1,
    color: INK,
  });
  y -= 34;

  const kpis: [string, string][] = [
    ["Checks run", String(n.checksRun)],
    ["Confirmed discrepancies", String(n.findingsConfirmed)],
    ["Critical catches", String(n.criticalConfirmed)],
    ["Staff cost savings (est.)", `$${n.staffDollars.toLocaleString()}`],
    ["Staff hours saved (est.)", n.hoursSaved.toFixed(1)],
    ["Exposure flagged (est.)", `$${n.exposureFlagged.toLocaleString()}`],
  ];
  const startY = y;
  kpis.forEach(([label, value], i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = M + col * 252;
    const yy = startY - row * 78;
    page.drawText(value, { x, y: yy, size: 26, font: bold, color: i === 2 || i === 3 ? VERIFY : INK });
    page.drawText(label, { x, y: yy - 16, size: 10, font: sans, color: MUTED });
  });
  y = startY - Math.ceil(kpis.length / 2) * 78 - 16;

  text("The period in one paragraph", 12, { font: bold });
  y -= 2;
  text(summaryParagraph(n, agencyName), 10.5);
  y -= 10;
  text(
    "Hours saved = checks × your manual check time. Exposure flagged = confirmed critical findings × your average account premium, an estimate based on your ROI assumptions, editable in Settings.",
    8.5,
    { color: MUTED }
  );

  page.drawText(
    "Prepared with BoundRight. Findings were reviewed and confirmed by a licensed agent.",
    { x: M, y: 64, size: 8, font: sans, color: MUTED }
  );
  drawBrandFooter(page, { bold, regular: sans, mono: sans }, { pageWidth: 612 });

  return doc.save();
}
