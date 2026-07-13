import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";
import { drawBrandFooter, drawSealLockup, drawVerificationStamp } from "./pdf-brand";

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
const FOOTER_H = 84;

const DISCLAIMER =
  "BoundRight is a review assistant and AI can make mistakes. It does not provide insurance advice, and final determination of coverage accuracy is the responsibility of the licensed agent; every finding in this report carries that agent's recorded decision.";

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
  doc_a_excerpt?: string | null;
  doc_b_excerpt?: string | null;
  dismiss_reason?: string | null;
};

type DocInfo = { filename: string; pages: number | null; sha256: string | null };

export type ReportData = {
  agencyName: string;
  logo?: { bytes: Uint8Array; kind: "png" | "jpg" } | null;
  reportId?: string;
  docA?: DocInfo;
  docB?: DocInfo;
  receivedAt?: string;
  processedAt?: string | null;
  /** 'smart_intake' | 'email' | 'manual' | 'sample' */
  source?: string;
  label: string;
  policyType: string;
  runDate: string;
  reviewerName: string;
  reviewedDate: string;
  /** MM·DD·YYYY, printed on the stamp's date line (brand guide 02). */
  stampDateLine: string;
  modelVersion: string;
  promptVersion: string;
  scanned: boolean;
  findings: ReportFinding[];
};

const DISMISS_LABEL: Record<string, string> = {
  not_a_discrepancy: "not a real discrepancy",
  wrong_extraction: "extracted value was wrong",
  duplicate: "duplicate finding",
  known_intentional: "known and intentional",
  other: "other",
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
  const monoBold = await doc.embedFont(StandardFonts.CourierBold);

  // Findable in a DMS/AMS: real document metadata.
  doc.setTitle(`Policy discrepancy report - ${data.label}`);
  doc.setAuthor(data.agencyName);
  doc.setSubject(`${data.policyType} · reviewed by ${data.reviewerName} on ${data.reviewedDate}`);
  doc.setProducer("BoundRight");
  doc.setCreationDate(new Date());

  let page!: PDFPage;
  let y = 0;

  const footer = (p: PDFPage) => {
    const lines = wrap(DISCLAIMER, sans, 7.5, PAGE_W - MARGIN * 2);
    let fy = FOOTER_H - 12;
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
    opts: { font?: PDFFont; size?: number; color?: ReturnType<typeof rgb>; x?: number; gap?: number; width?: number } = {}
  ) => {
    const { font = sans, size = 10, color = INK, x = MARGIN, gap = 4 } = opts;
    const lines = wrap(str, font, size, opts.width ?? PAGE_W - MARGIN - x);
    for (const line of lines) {
      ensure(size + gap);
      page.drawText(line, { x, y: y - size, size, font, color });
      y -= size + gap;
    }
  };

  const chip = (label: string, color: ReturnType<typeof rgb>, x: number): number => {
    const size = 8;
    const w = mono.widthOfTextAtSize(label.toUpperCase(), size) + 10;
    page.drawRectangle({
      x,
      y: y - 14,
      width: w,
      height: 15,
      borderColor: color,
      borderWidth: 0.8,
    });
    page.drawText(label.toUpperCase(), { x: x + 5, y: y - 10, size, font: mono, color });
    return x + w + 8;
  };

  newPage();

  // Header: logo co-branding when available, else the agency name.
  if (data.logo) {
    try {
      const img =
        data.logo.kind === "png"
          ? await doc.embedPng(data.logo.bytes)
          : await doc.embedJpg(data.logo.bytes);
      const h = 28;
      const w = (img.width / img.height) * h;
      page.drawImage(img, { x: MARGIN, y: y - h, width: Math.min(w, 180), height: h });
      y -= h + 10;
      text(data.agencyName, { font: sansBold, size: 11, gap: 6 });
    } catch {
      text(data.agencyName, { font: sansBold, size: 16, gap: 6 });
    }
  } else {
    text(data.agencyName, { font: sansBold, size: 16, gap: 6 });
  }
  text("Policy discrepancy report · Proof it was bound right.", {
    size: 9,
    color: MUTED,
    gap: 16,
  });
  // Header mark is the primary lockup (brand guide 02); the verification
  // stamp lands at the certification block, where the review is attested.
  drawSealLockup(page, { x: PAGE_W - MARGIN - 122, y: PAGE_H - MARGIN - 20, bold: sansBold, regular: sans, mono: monoBold });
  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 1, color: INK });
  y -= 18;

  text(data.label, { font: sansBold, size: 13, gap: 6 });
  text(`Policy type: ${data.policyType}   ·   Report ${data.reportId ?? ""}`, {
    size: 9,
    color: MUTED,
    gap: 10,
  });

  // Audit timeline
  const fmtTs = (iso?: string | null) =>
    iso
      ? new Date(iso).toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })
      : "n/a";
  text("AUDIT TRAIL", { font: sansBold, size: 9, gap: 4 });
  const intakeNote =
    data.source === "smart_intake"
      ? " · intake: smart intake (AI-proposed pair, confirmed by your team)"
      : data.source === "email"
        ? " · intake: email"
        : "";
  text(
    `Documents received ${fmtTs(data.receivedAt)} · processed ${fmtTs(data.processedAt)} · reviewed by ${data.reviewerName} on ${data.reviewedDate} · exported ${fmtTs(new Date().toISOString())}${intakeNote}`,
    { size: 8.5, color: MUTED, gap: 14 }
  );

  // Documents examined: fingerprints computed before deletion.
  if (data.docA?.sha256 || data.docB?.sha256) {
    text("DOCUMENTS EXAMINED", { font: sansBold, size: 9, gap: 4 });
    for (const [side, d] of [
      ["A", data.docA],
      ["B", data.docB],
    ] as const) {
      if (!d) continue;
      text(
        `${side}: ${d.filename}${d.pages ? ` · ${d.pages} pages` : ""}`,
        { size: 8.5, gap: 2, x: MARGIN + 8 }
      );
      if (d.sha256) {
        text(`SHA-256 ${d.sha256}`, { font: mono, size: 7, color: MUTED, gap: 4, x: MARGIN + 8 });
      }
    }
    text(
      "A recomputed SHA-256 that matches proves a copy is the exact file examined. Originals were deleted after processing.",
      { size: 7.5, color: MUTED, gap: 16 }
    );
  }

  if (data.scanned) {
    text(
      "Notice: one or more source documents were scanned images. Extraction confidence is reduced; findings were verified against the source documents by the reviewer.",
      { size: 9, color: CAUTION, gap: 10 }
    );
  }

  // Summary + reconciliation
  const issues = data.findings.filter((f) => f.status !== "match");
  const matches = data.findings.filter((f) => f.status === "match");
  const count = (sev: string) => issues.filter((f) => f.severity === sev).length;

  ensure(46);
  let sx = MARGIN;
  sx = chip(`${count("critical")} critical`, FLAG, sx);
  sx = chip(`${count("moderate")} moderate`, CAUTION, sx);
  sx = chip(`${count("minor")} minor`, MUTED, sx);
  chip(`${matches.length} matches`, VERIFY, sx);
  y -= 22;
  text(
    `${data.findings.length} fields compared: ${issues.length} discrepanc${issues.length === 1 ? "y" : "ies"} (${issues.filter((f) => f.reviewer_action === "confirmed").length} confirmed, ${issues.filter((f) => f.reviewer_action === "dismissed").length} dismissed by the reviewer) and ${matches.length} matches.`,
    { size: 9, gap: 18 }
  );

  // Findings by severity, each an exhibit with its cited source text.
  for (const sev of ["critical", "moderate", "minor"] as const) {
    const group = issues.filter((f) => f.severity === sev);
    if (group.length === 0) continue;

    ensure(30);
    text(`${sev.toUpperCase()} FINDINGS`, { font: sansBold, size: 11, gap: 10 });

    for (const f of group) {
      ensure(90);
      const color = sev === "critical" ? FLAG : sev === "moderate" ? CAUTION : MUTED;
      page.drawLine({
        start: { x: MARGIN, y: y + 2 },
        end: { x: PAGE_W - MARGIN, y: y + 2 },
        thickness: 0.5,
        color: LINE,
      });
      y -= 10;

      text(f.field_name, { font: sansBold, size: 10, gap: 4 });
      const citation = [
        f.doc_a_page ? `Document A p. ${f.doc_a_page}` : null,
        f.doc_b_page ? `Document B p. ${f.doc_b_page}` : null,
      ]
        .filter(Boolean)
        .join("  ·  ");
      text(
        `${f.category.replace("_", " ")} · ${f.status.replaceAll("_", " ")}${citation ? ` · ${citation}` : ""} · confidence: ${f.confidence}`,
        { size: 8, color: MUTED, gap: 8 }
      );
      text(`Source doc: ${f.expected_value ?? "(not found)"}`, { font: mono, size: 9, x: MARGIN + 12, gap: 3 });
      if (f.doc_a_excerpt) {
        text(`"${f.doc_a_excerpt}"`, { size: 7.5, color: MUTED, x: MARGIN + 24, gap: 5 });
      }
      text(`Issued doc: ${f.found_value ?? "(not found)"}`, { font: mono, size: 9, x: MARGIN + 12, gap: 3 });
      if (f.doc_b_excerpt) {
        text(`"${f.doc_b_excerpt}"`, { size: 7.5, color: MUTED, x: MARGIN + 24, gap: 5 });
      }
      y -= 4;
      const decision = f.reviewer_action
        ? f.reviewer_action === "dismissed" && f.dismiss_reason
          ? `DISMISSED (${DISMISS_LABEL[f.dismiss_reason] ?? f.dismiss_reason})`
          : f.reviewer_action.toUpperCase()
        : "no action recorded";
      text(`Reviewer decision: ${decision}`, {
        size: 9,
        color: f.reviewer_action === "confirmed" ? color : MUTED,
        gap: 4,
      });
      if (f.reviewer_note) {
        text(`Note: ${f.reviewer_note}`, { size: 9, x: MARGIN + 12, gap: 4 });
      }
      y -= 18;
    }
    y -= 8;
  }

  // Matches
  ensure(30);
  text(`MATCHED FIELDS (${matches.length})`, { font: sansBold, size: 11, gap: 10 });
  for (const f of matches) {
    ensure(14);
    text(`${f.field_name}: ${f.expected_value ?? ""}`, {
      font: mono,
      size: 8.5,
      x: MARGIN + 12,
      gap: 3.5,
    });
  }

  // Certification: the work-product claim, stated rather than implied. The
  // dated BOUND RIGHT stamp sits here, at the verification moment.
  ensure(92);
  y -= 10;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 0.75, color: INK });
  y -= 12;
  drawVerificationStamp(page, monoBold, { x: PAGE_W - MARGIN - 100, topY: y + 4, dateLine: data.stampDateLine });
  text("REVIEWER CERTIFICATION", { font: sansBold, size: 9, gap: 4 });
  text(
    "I have reviewed each finding above against the source documents, and the decisions recorded in this report are mine.",
    { size: 9, gap: 8, width: PAGE_W - MARGIN * 2 - 130 }
  );
  text(`${data.reviewerName} · ${data.agencyName} · ${data.reviewedDate}`, {
    font: sansBold,
    size: 9.5,
    gap: 4,
    width: PAGE_W - MARGIN * 2 - 130,
  });

  // Second pass: report ID + pagination on every page footer.
  const pages = doc.getPages();
  pages.forEach((p, i) => {
    drawBrandFooter(p, { bold: sansBold, regular: sans, mono }, {
      pageWidth: PAGE_W,
      rightTag: `${data.reportId ?? "BoundRight report"} · Page ${i + 1} of ${pages.length}`,
    });
  });

  return doc.save();
}
