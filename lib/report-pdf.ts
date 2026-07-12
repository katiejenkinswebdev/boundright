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
const FOOTER_H = 64;

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
  label: string;
  policyType: string;
  runDate: string;
  reviewerName: string;
  reviewedDate: string;
  /** MM·DD·YYYY, printed on the stamp's date line. */
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
    const lines = wrap(DISCLAIMER, sans, 7.5, PAGE_W - MARGIN * 2 - 170);
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

  const boundRightStamp = (x: number, topY: number) => {
    const rot = degrees(-3);
    page.drawRectangle({
      x,
      y: topY - 54,
      width: 92,
      height: 54,
      borderColor: VERIFY,
      borderWidth: 1.6,
      rotate: rot,
    });
    const line = (t: string, dy: number, size: number, spacing = 3) => {
      let cx = x + 13;
      for (const ch of t) {
        page.drawText(ch, { x: cx, y: topY - dy, size, font: monoBold, color: VERIFY, rotate: rot });
        cx += monoBold.widthOfTextAtSize(ch, size) + spacing;
      }
    };
    line("BOUND", 20, 11);
    line("RIGHT", 33, 11);
    line(data.stampDateLine, 45, 6.5, 1.5);
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
      y -= h + 6;
      text(data.agencyName, { font: sansBold, size: 11, gap: 2 });
    } catch {
      text(data.agencyName, { font: sansBold, size: 16, gap: 2 });
    }
  } else {
    text(data.agencyName, { font: sansBold, size: 16, gap: 2 });
  }
  text("Policy discrepancy report · Proof it was bound right.", {
    size: 9,
    color: MUTED,
    gap: 12,
  });
  boundRightStamp(PAGE_W - MARGIN - 100, PAGE_H - MARGIN + 6);
  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 1, color: INK });
  y -= 14;

  text(data.label, { font: sansBold, size: 13, gap: 6 });
  text(
    `Policy type: ${data.policyType}   ·   Report ${data.reportId ?? ""}   ·   Engine: ${data.modelVersion} (${data.promptVersion})`,
    { size: 9, color: MUTED, gap: 10 }
  );

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
  text(
    `Documents received ${fmtTs(data.receivedAt)} · processed ${fmtTs(data.processedAt)} · reviewed by ${data.reviewerName} on ${data.reviewedDate} · exported ${fmtTs(new Date().toISOString())}`,
    { size: 8.5, color: MUTED, gap: 10 }
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
      "Verify a copy of either document by recomputing its SHA-256 hash; a match proves it is the exact file this report examined. The files themselves were deleted after processing.",
      { size: 7.5, color: MUTED, gap: 10 }
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
    { size: 9, gap: 12 }
  );

  // Findings by severity, each an exhibit with its cited source text.
  for (const sev of ["critical", "moderate", "minor"] as const) {
    const group = issues.filter((f) => f.severity === sev);
    if (group.length === 0) continue;

    ensure(30);
    text(`${sev.toUpperCase()} FINDINGS`, { font: sansBold, size: 11, gap: 8 });

    for (const f of group) {
      ensure(90);
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
        f.doc_a_page ? `Document A p. ${f.doc_a_page}` : null,
        f.doc_b_page ? `Document B p. ${f.doc_b_page}` : null,
      ]
        .filter(Boolean)
        .join("  ·  ");
      text(
        `${f.category.replace("_", " ")} · ${f.status.replaceAll("_", " ")}${citation ? ` · ${citation}` : ""} · confidence: ${f.confidence}`,
        { size: 8, color: MUTED, gap: 5 }
      );
      text(`Source doc: ${f.expected_value ?? "(not found)"}`, { font: mono, size: 9, x: MARGIN + 12, gap: 3 });
      if (f.doc_a_excerpt) {
        text(`"${f.doc_a_excerpt}"`, { size: 7.5, color: MUTED, x: MARGIN + 24, gap: 3 });
      }
      text(`Issued doc: ${f.found_value ?? "(not found)"}`, { font: mono, size: 9, x: MARGIN + 12, gap: 3 });
      if (f.doc_b_excerpt) {
        text(`"${f.doc_b_excerpt}"`, { size: 7.5, color: MUTED, x: MARGIN + 24, gap: 3 });
      }
      const decision = f.reviewer_action
        ? f.reviewer_action === "dismissed" && f.dismiss_reason
          ? `DISMISSED (${DISMISS_LABEL[f.dismiss_reason] ?? f.dismiss_reason})`
          : f.reviewer_action.toUpperCase()
        : "no action recorded";
      text(`Reviewer decision: ${decision}`, {
        size: 9,
        color: f.reviewer_action === "confirmed" ? color : MUTED,
        gap: 3,
      });
      if (f.reviewer_note) {
        text(`Note: ${f.reviewer_note}`, { size: 9, x: MARGIN + 12, gap: 3 });
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

  // Certification: the work-product claim, stated rather than implied.
  ensure(70);
  y -= 10;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 0.75, color: INK });
  y -= 12;
  text("REVIEWER CERTIFICATION", { font: sansBold, size: 9, gap: 4 });
  text(
    "I have reviewed each finding above against the source documents, and the decisions recorded in this report are mine.",
    { size: 9, gap: 8 }
  );
  text(`${data.reviewerName} · ${data.agencyName} · ${data.reviewedDate}`, {
    font: sansBold,
    size: 9.5,
    gap: 4,
  });

  // Second pass: report ID + pagination on every page footer.
  const pages = doc.getPages();
  pages.forEach((p, i) => {
    const tag = `${data.reportId ?? "BoundRight report"} · Page ${i + 1} of ${pages.length}`;
    p.drawText(tag, {
      x: PAGE_W - MARGIN - mono.widthOfTextAtSize(tag, 7.5),
      y: FOOTER_H - 14,
      size: 7.5,
      font: mono,
      color: MUTED,
    });
  });

  return doc.save();
}
