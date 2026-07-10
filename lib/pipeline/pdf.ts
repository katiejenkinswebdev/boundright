import { extractText, getDocumentProxy } from "unpdf";

export const MAX_PAGES = 300;
export const MAX_BYTES = 50 * 1024 * 1024;
/** Below this fraction of pages with real text, we treat the doc as scanned. */
const TEXT_COVERAGE_THRESHOLD = 0.2;
/** A page with fewer characters than this is considered to have no text layer. */
const MIN_CHARS_PER_PAGE = 40;

export type PdfIngestResult =
  | {
      ok: true;
      pageCount: number;
      scanned: boolean;
      /** Per-page text, joined with page markers, ready for the extract prompt. */
      pagesText: string;
      /** Raw per-page text for excerpting during the verify pass. */
      pages: string[];
    }
  | { ok: false; reason: "password_protected" | "not_a_pdf" | "too_many_pages"; pageCount?: number };

export async function ingestPdf(data: Uint8Array): Promise<PdfIngestResult> {
  let pdf;
  try {
    pdf = await getDocumentProxy(data);
  } catch (err) {
    const name = (err as { name?: string })?.name ?? "";
    const message = err instanceof Error ? err.message : String(err);
    if (name === "PasswordException" || /password/i.test(message)) {
      return { ok: false, reason: "password_protected" };
    }
    return { ok: false, reason: "not_a_pdf" };
  }

  if (pdf.numPages > MAX_PAGES) {
    return { ok: false, reason: "too_many_pages", pageCount: pdf.numPages };
  }

  const { text } = await extractText(pdf, { mergePages: false });
  const pages = (text as string[]).map((t) => t.trim());
  const pagesWithText = pages.filter((t) => t.length >= MIN_CHARS_PER_PAGE).length;
  const scanned = pagesWithText / pages.length < TEXT_COVERAGE_THRESHOLD;

  const pagesText = pages
    .map((t, i) => `=== PAGE ${i + 1} ===\n${t}`)
    .join("\n\n");

  return { ok: true, pageCount: pdf.numPages, scanned, pagesText, pages };
}

/** Pull the pages around a citation for the verify pass (1-indexed, ±1 page). */
export function excerptPages(pages: string[], page: number | null): string {
  if (page === null || page < 1 || page > pages.length) {
    return "(no page citation available)";
  }
  const idx = page - 1;
  const slice = pages.slice(Math.max(0, idx - 1), Math.min(pages.length, idx + 2));
  return slice
    .map((t, i) => `=== PAGE ${Math.max(1, page - 1) + i} ===\n${t}`)
    .join("\n\n");
}
