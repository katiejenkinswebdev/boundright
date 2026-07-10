import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { SupabaseClient } from "@supabase/supabase-js";

const INK = rgb(0.106, 0.165, 0.255);
const VERIFY = rgb(0.122, 0.478, 0.361);
const MUTED = rgb(0.45, 0.45, 0.45);

export type MonthlyNumbers = {
  monthLabel: string; // "June 2026"
  monthDate: string; // "2026-06-01"
  checksRun: number;
  findingsConfirmed: number;
  criticalConfirmed: number;
  hoursSaved: number;
  exposureFlagged: number;
};

export async function computeMonthlyNumbers(
  db: SupabaseClient,
  agency: {
    id: string;
    manual_check_minutes: number;
    avg_account_premium: number;
  },
  monthStart: Date
): Promise<MonthlyNumbers> {
  const monthEnd = new Date(
    Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 1)
  );
  const from = monthStart.toISOString();
  const to = monthEnd.toISOString();

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

  return {
    monthLabel: monthStart.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }),
    monthDate: monthStart.toISOString().slice(0, 10),
    checksRun,
    findingsConfirmed,
    criticalConfirmed,
    hoursSaved: (checksRun * agency.manual_check_minutes) / 60,
    exposureFlagged: criticalConfirmed * Number(agency.avg_account_premium),
  };
}

function summaryParagraph(n: MonthlyNumbers, agencyName: string): string {
  if (n.checksRun === 0) {
    return `${agencyName} ran no policy checks in ${n.monthLabel}. Every unchecked renewal is an unreviewed E&O exposure — the fastest win next month is checking each renewal as it's issued.`;
  }
  const pieces = [
    `In ${n.monthLabel}, ${agencyName} ran ${n.checksRun} policy check${n.checksRun === 1 ? "" : "s"} through BoundRight`,
    n.findingsConfirmed > 0
      ? `and the team confirmed ${n.findingsConfirmed} discrepanc${n.findingsConfirmed === 1 ? "y" : "ies"} between what was sold and what was issued`
      : `and every compared field matched — clean issuance across the board`,
  ];
  let s = pieces.join(" ") + ".";
  if (n.criticalConfirmed > 0) {
    s += ` ${n.criticalConfirmed} ${n.criticalConfirmed === 1 ? "was" : "were"} critical — limits, forms, or dates that would have surfaced at claim time. Based on the agency's average account premium, that's an estimated $${n.exposureFlagged.toLocaleString()} of exposure caught before the client found it.`;
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
  let y = 792 - 64;

  const text = (
    str: string,
    size: number,
    opts: { font?: typeof sans; color?: ReturnType<typeof rgb>; x?: number } = {}
  ) => {
    // naive wrap
    const font = opts.font ?? sans;
    const maxW = 612 - 64 - (opts.x ?? 64);
    const words = str.split(" ");
    let line = "";
    const flush = () => {
      page.drawText(line, { x: opts.x ?? 64, y, size, font, color: opts.color ?? INK });
      y -= size + 6;
      line = "";
    };
    for (const w of words) {
      const cand = line ? `${line} ${w}` : w;
      if (font.widthOfTextAtSize(cand, size) > maxW) flush();
      line = line ? `${line} ${w}` : w;
    }
    if (line) flush();
  };

  text(agencyName, 18, { font: bold });
  text(`Policy Check ROI Report — ${n.monthLabel}`, 12, { color: MUTED });
  y -= 12;
  page.drawLine({
    start: { x: 64, y },
    end: { x: 548, y },
    thickness: 1,
    color: INK,
  });
  y -= 28;

  const kpis: [string, string][] = [
    ["Checks run", String(n.checksRun)],
    ["Confirmed discrepancies", String(n.findingsConfirmed)],
    ["Critical catches", String(n.criticalConfirmed)],
    ["Staff hours saved (est.)", n.hoursSaved.toFixed(1)],
    ["Exposure flagged (est.)", `$${n.exposureFlagged.toLocaleString()}`],
  ];
  const startY = y;
  kpis.forEach(([label, value], i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 64 + col * 250;
    const yy = startY - row * 72;
    page.drawText(value, { x, y: yy, size: 26, font: bold, color: i === 2 || i === 4 ? VERIFY : INK });
    page.drawText(label, { x, y: yy - 16, size: 10, font: sans, color: MUTED });
  });
  y = startY - Math.ceil(kpis.length / 2) * 72 - 12;

  text("The month in one paragraph", 12, { font: bold });
  y -= 2;
  text(summaryParagraph(n, agencyName), 10.5);
  y -= 10;
  text(
    "Hours saved = checks × your manual check time. Exposure flagged = confirmed critical findings × your average account premium — an estimate based on your ROI assumptions, editable in Settings.",
    8.5,
    { color: MUTED }
  );

  page.drawText(
    "Prepared with BoundRight — the policy checking assistant. Findings were reviewed and confirmed by a licensed agent.",
    { x: 64, y: 48, size: 8, font: sans, color: MUTED }
  );

  return doc.save();
}
