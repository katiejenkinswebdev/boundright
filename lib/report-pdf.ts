import { PDFDocument, PDFFont, PDFPage, StandardFonts, degrees, rgb } from "pdf-lib";

// Palette (design tokens, print-friendly)
const INK = rgb(0.106, 0.165, 0.255);
const VERIFY = rgb(0.122, 0.478, 0.361);
const FLAG = rgb(0.769, 0.271, 0.169);
const CAUTION = rgb(0.718, 0.475, 0.122);
const MUTED = rgb(0.45, 0.45, 0.45);
const LINE = rgb(0.847, 0.851, 0.831);

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 54;
const FOOTER_H = 60;

const DISCLAIMER =
  "BoundRight is a review assistant. It does not provide insurance advice, and final determination of coverage accuracy is the responsibility of the licensed agent.";

export type ReportFinding = {
  field_name: string;
  category: string;
  status: string;
  severity: string | null;
  expected_value: string | null;
  found_value: string | null;
  doc_a_page: number | null;
  doc_b_page: number | null;
  confidence: string;
  reviewer_action: string | null;
  reviewer_note: string | null;
};

export type ReportData = {
  agencyName: string;
  label: string;
  policyType: string;
  runDate: string;
  reviewerName: string;
  reviewedDate: string;
  modelVersion: string;
  promptVersion: string;
  scanned: boolean;
  findings: ReportFinding[];
};

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= width) {
      line = candidate;
    } else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

export async function buildReportPdf(data: ReportData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const sans = await doc.embedFont(StandardFonts.Helvetica);
  const sansBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const mono = await doc.embedFont(StandardFonts.Courier);

  // Assigned by newPage() before any drawing; the definite-assignment
  // assertion reflects the newPage() call preceding all draw calls below.
  let page!: PDFPage;
  let y = 0;

  const footer = (p: PDFPage) => {
    const lines = wrap(DISCLAIMER, sans, 7.5, PAGE_W - MARGIN * 2);
    let fy = FOOTER_H - 14;
    p.drawLine({
      start: { x: MARGIN, y: FOOTER_H },
      end: { x: PAGE_W - MARGIN, y: FOOTER_H },
      thickness: 0.5,
      color: LINE,
    });
    for (const line of lines) {
      p.drawText(line, { x: MARGIN, y: fy, size: 7.5, font: sans, color: MUTED });
      fy -= 10;
    }
  };

  const newPage = () => {
    page = doc.addPage([PAGE_W, PAGE_H]);
    footer(page);
    y = PAGE_H - MARGIN;
  };

  const ensure = (needed: number) => {
    if (y - needed < FOOTER_H + 20) newPage();
  };

  const text = (
    str: string,
    opts: { font?: PDFFont; size?: number; color?: ReturnType<typeof rgb>; x?: number; gap?: number } = {}
  ) => {
    const { font = sans, size = 10, color = INK, x = MARGIN, gap = 4 } = opts;
    const lines = wrap(str, font, size, PAGE_W - MARGIN - x);
    for (const line of lines) {
      ensure(size + gap);
      page.drawText(line, { x, y: y - size, size, font, color });
      y -= size + gap;
    }
  };

  const stamp = (label: string, color: ReturnType<typeof rgb>, x: number): number => {
    const size = 8;
    const w = mono.widthOfTextAtSize(label.toUpperCase(), size) + 10;
    page.drawRectangle({
      x,
      y: y - 14,
      width: w,
      height: 15,
      borderColor: color,
      borderWidth: 1.2,
      rotate: degrees(-1.5),
    });
    page.drawText(label.toUpperCase(), {
      x: x + 5,
      y: y - 10,
      size,
      font: mono,
      color,
    });
    return x + w + 8;
  };

  newPage();

  // Header
  text(data.agencyName, { font: sansBold, size: 16, gap: 2 });
  text("Policy Discrepancy Report — prepared with BoundRight", {
    size: 9,
    color: MUTED,
    gap: 12,
  });
  page.drawLine({
    start: { x: MARGIN, y: y },
    end: { x: PAGE_W - MARGIN, y: y },
    thickness: 1,
    color: INK,
  });
  y -= 14;

  text(data.label, { font: sansBold, size: 13, gap: 6 });
  text(
    `Policy type: ${data.policyType}   ·   Check run: ${data.runDate}   ·   Documents compared: proposal/binder vs. issued policy`,
    { size: 9, color: MUTED, gap: 3 }
  );
  text(
    `Reviewed by ${data.reviewerName} on ${data.reviewedDate}   ·   Engine: ${data.modelVersion} (${data.promptVersion})`,
    { size: 9, color: MUTED, gap: 12 }
  );

  if (data.scanned) {
    text(
      "Notice: one or more source documents were scanned images. Extraction confidence is reduced — findings were verified against the source documents by the reviewer.",
      { size: 9, color: CAUTION, gap: 12 }
    );
  }

  // Summary
  const issues = data.findings.filter((f) => f.status !== "match");
  const matches = data.findings.filter((f) => f.status === "match");
  const count = (sev: string) => issues.filter((f) => f.severity === sev).length;

  ensure(30);
  let sx = MARGIN;
  sx = stamp(`${count("critical")} critical`, FLAG, sx);
  sx = stamp(`${count("moderate")} moderate`, CAUTION, sx);
  sx = stamp(`${count("minor")} minor`, MUTED, sx);
  stamp(`${matches.length} matches`, VERIFY, sx);
  y -= 30;

  // Findings by severity
  for (const sev of ["critical", "moderate", "minor"] as const) {
    const group = issues.filter((f) => f.severity === sev);
    if (group.length === 0) continue;

    ensure(30);
    text(`${sev.toUpperCase()} FINDINGS`, { font: sansBold, size: 11, gap: 8 });

    for (const f of group) {
      ensure(80);
      const color = sev === "critical" ? FLAG : sev === "moderate" ? CAUTION : MUTED;
      page.drawLine({
        start: { x: MARGIN, y: y + 2 },
        end: { x: PAGE_W - MARGIN, y: y + 2 },
        thickness: 0.5,
        color: LINE,
      });
      y -= 8;

      text(f.field_name, { font: sansBold, size: 10, gap: 3 });
      const citation = [
        f.doc_a_page ? `Proposal p. ${f.doc_a_page}` : null,
        f.doc_b_page ? `Policy p. ${f.doc_b_page}` : null,
      ]
        .filter(Boolean)
        .join("  ·  ");
      text(
        `${f.category.replace("_", " ")} · ${f.status.replaceAll("_", " ")}${citation ? ` · ${citation}` : ""} · confidence: ${f.confidence}`,
        { size: 8, color: MUTED, gap: 5 }
      );
      text(`Proposal: ${f.expected_value ?? "(not found)"}`, {
        font: mono,
        size: 9,
        x: MARGIN + 12,
        gap: 3,
      });
      text(`Policy:   ${f.found_value ?? "(not found)"}`, {
        font: mono,
        size: 9,
        x: MARGIN + 12,
        gap: 5,
      });
      text(
        `Reviewer decision: ${f.reviewer_action ? f.reviewer_action.toUpperCase() : "no action recorded"}`,
        { size: 9, color: f.reviewer_action === "confirmed" ? color : MUTED, gap: 3 }
      );
      if (f.reviewer_note) {
        text(`Note: ${f.reviewer_note}`, { size: 9, color: INK, x: MARGIN + 12, gap: 3 });
      }
      y -= 8;
    }
    y -= 6;
  }

  // Matches
  ensure(30);
  text(`MATCHED FIELDS (${matches.length})`, { font: sansBold, size: 11, gap: 8 });
  for (const f of matches) {
    ensure(14);
    text(`${f.field_name}: ${f.expected_value ?? ""}`, {
      font: mono,
      size: 8.5,
      x: MARGIN + 12,
      gap: 2.5,
    });
  }

  return doc.save();
}
