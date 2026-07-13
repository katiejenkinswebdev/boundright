import type { PDFFont, PDFPage } from "pdf-lib";
import { degrees, rgb } from "pdf-lib";

/** Shared print branding for every BoundRight PDF. */
export const PDF_INK = rgb(0.106, 0.165, 0.255);
export const PDF_MUTED = rgb(0.45, 0.45, 0.45);
export const PDF_LINE = rgb(0.847, 0.851, 0.831);
export const PDF_VERIFY = rgb(0.122, 0.478, 0.361);
export const PDF_BLACK = rgb(0, 0, 0);
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
 * The BOUND RIGHT verification stamp (brand guide: "the full stamp is not
 * the logo"). Verify Green, tilted within 4 degrees, date line carries the
 * review date. Reserved for confirmed reports; never decorative.
 */
export function drawVerificationStamp(
  page: PDFPage,
  monoBold: PDFFont,
  opts: { x: number; topY: number; dateLine: string }
): void {
  const { x, topY, dateLine } = opts;
  const rot = degrees(-3);
  page.drawRectangle({
    x,
    y: topY - 54,
    width: 92,
    height: 54,
    borderColor: PDF_VERIFY,
    borderWidth: 1.6,
    rotate: rot,
  });
  const line = (t: string, dy: number, size: number, spacing = 3) => {
    let cx = x + 13;
    for (const ch of t) {
      page.drawText(ch, { x: cx, y: topY - dy, size, font: monoBold, color: PDF_VERIFY, rotate: rot });
      cx += monoBold.widthOfTextAtSize(ch, size) + spacing;
    }
  };
  line("BOUND", 20, 11);
  line("RIGHT", 33, 11);
  line(dateLine, 45, 6.5, 1.5);
}

/**
 * The primary logo lockup (brand guide 02): tilted BR monogram seal +
 * level wordmark. The header mark for every non-verified BoundRight PDF.
 */
export function drawSealLockup(
  page: PDFPage,
  opts: { x: number; y: number; bold: PDFFont; regular: PDFFont; mono: PDFFont }
): void {
  const { x, y, bold, regular, mono } = opts;
  const size = 22;
  const rot = degrees(-3);
  // Rounded-square seal border, tilted per the primary lockup.
  page.drawSvgPath(
    "M 5 0 h 12 a 5 5 0 0 1 5 5 v 12 a 5 5 0 0 1 -5 5 h -12 a 5 5 0 0 1 -5 -5 v -5 -7 a 5 5 0 0 1 5 -5 z",
    { x, y: y + size, borderColor: PDF_BLACK, borderWidth: 1.6, color: undefined, rotate: rot }
  );
  // Center the monogram from measured glyph metrics, not eyeballed offsets.
  const brSize = 8.5;
  const brWidth = mono.widthOfTextAtSize("BR", brSize);
  const capHeight = mono.heightAtSize(brSize, { descender: false }) * 0.72;
  page.drawText("BR", {
    x: x + (size - brWidth) / 2,
    y: y + (size - capHeight) / 2,
    size: brSize,
    font: mono,
    color: PDF_BLACK,
    rotate: rot,
  });
  drawWordmark(page, { x: x + size + 8, y: y + 6, size: 12, bold, regular });
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
