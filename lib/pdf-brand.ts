import type { PDFFont, PDFPage } from "pdf-lib";
import { rgb } from "pdf-lib";

/** Shared print branding for every BoundRight PDF. */
export const PDF_INK = rgb(0.106, 0.165, 0.255);
export const PDF_MUTED = rgb(0.45, 0.45, 0.45);
export const PDF_LINE = rgb(0.847, 0.851, 0.831);
export const PDF_MARGIN = 54;

/** The wordmark: "Bound" semibold + "Right" regular, always Ink. */
export function drawWordmark(
  page: PDFPage,
  opts: { x: number; y: number; size: number; bold: PDFFont; regular: PDFFont }
): number {
  const { x, y, size, bold, regular } = opts;
  page.drawText("Bound", { x, y, size, font: bold, color: PDF_INK });
  const w1 = bold.widthOfTextAtSize("Bound", size);
  page.drawText("Right", { x: x + w1, y, size, font: regular, color: PDF_INK });
  return w1 + regular.widthOfTextAtSize("Right", size);
}

/**
 * The BR monogram seal + wordmark lockup for report headers. Level (not
 * tilted) for print crispness; the tilted stamp remains reserved for
 * verified documents.
 */
export function drawSealLockup(
  page: PDFPage,
  opts: { x: number; y: number; bold: PDFFont; regular: PDFFont; mono: PDFFont }
): void {
  const { x, y, bold, regular, mono } = opts;
  const size = 22;
  // Rounded-square seal border.
  page.drawSvgPath(
    "M 5 0 h 12 a 5 5 0 0 1 5 5 v 12 a 5 5 0 0 1 -5 5 h -12 a 5 5 0 0 1 -5 -5 v -5 -7 a 5 5 0 0 1 5 -5 z",
    { x, y: y + size, borderColor: PDF_INK, borderWidth: 1.6, color: undefined }
  );
  const brW = mono.widthOfTextAtSize("BR", 8.5);
  page.drawText("BR", {
    x: x + (size - brW) / 2,
    y: y + 7,
    size: 8.5,
    font: mono,
    color: PDF_INK,
  });
  drawWordmark(page, { x: x + size + 7, y: y + 6, size: 12, bold, regular });
}

/**
 * The standard report footer: wordmark + tagline on the left, an optional
 * right-aligned tag (report id, pagination). Returns nothing; draws at the
 * bottom of the given page. Keep every report on this footer.
 */
export function drawBrandFooter(
  page: PDFPage,
  fonts: { bold: PDFFont; regular: PDFFont; mono: PDFFont },
  opts: { pageWidth: number; rightTag?: string }
) {
  const y = 40;
  page.drawLine({
    start: { x: PDF_MARGIN, y: y + 14 },
    end: { x: opts.pageWidth - PDF_MARGIN, y: y + 14 },
    thickness: 0.5,
    color: PDF_LINE,
  });
  const w = drawWordmark(page, { x: PDF_MARGIN, y, size: 9, bold: fonts.bold, regular: fonts.regular });
  page.drawText("· Every account. Bound right.", {
    x: PDF_MARGIN + w + 5,
    y,
    size: 8,
    font: fonts.regular,
    color: PDF_MUTED,
  });
  if (opts.rightTag) {
    page.drawText(opts.rightTag, {
      x: opts.pageWidth - PDF_MARGIN - fonts.mono.widthOfTextAtSize(opts.rightTag, 7.5),
      y,
      size: 7.5,
      font: fonts.mono,
      color: PDF_MUTED,
    });
  }
}
