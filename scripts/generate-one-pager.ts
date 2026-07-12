// Generates the data-processing one-pager (spec 8.8): the PDF an agency
// hands to whoever asks "where does our data go?" during due diligence.
// Usage: npx tsx scripts/generate-one-pager.ts   -> public/boundright-data-processing.pdf
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { drawBrandFooter, drawSealLockup, drawWordmark } from "../lib/pdf-brand";
import fs from "node:fs";
import path from "node:path";

const INK = rgb(0.106, 0.165, 0.255);
const MUTED = rgb(0.45, 0.45, 0.45);
const LINE = rgb(0.847, 0.851, 0.831);

async function main() {
const doc = await PDFDocument.create();
const sans = await doc.embedFont(StandardFonts.Helvetica);
const bold = await doc.embedFont(StandardFonts.HelveticaBold);
const page = doc.addPage([612, 792]);
const M = 56;
let y = 792 - M;

function text(
  str: string,
  size: number,
  opts: { font?: typeof sans; color?: ReturnType<typeof rgb>; gap?: number; x?: number } = {}
) {
  const font = opts.font ?? sans;
  const x = opts.x ?? M;
  const maxW = 612 - M - x;
  const words = str.split(" ");
  let line = "";
  const flush = () => {
    page.drawText(line, { x, y, size, font, color: opts.color ?? INK });
    y -= size + (opts.gap ?? 4);
    line = "";
  };
  for (const w of words) {
    const cand = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(cand, size) > maxW) flush();
    line = line ? `${line} ${w}` : w;
  }
  if (line) flush();
}

function rule(gap = 14) {
  page.drawLine({ start: { x: M, y }, end: { x: 612 - M, y }, thickness: 0.75, color: LINE });
  y -= gap;
}

function section(title: string, items: string[]) {
  y -= 6;
  text(title, 12, { font: bold, gap: 6 });
  for (const item of items) text(item, 10, { gap: 5 });
  y -= 4;
  rule();
}

// Header
drawSealLockup(page, { x: M, y: y - 24, bold, regular: sans, mono: bold });
y -= 32;
text("Data processing overview · for agency due diligence · v1.0, July 2026", 9, {
  color: MUTED,
  gap: 14,
});
page.drawLine({ start: { x: M, y }, end: { x: 612 - M - 125, y }, thickness: 1.2, color: INK });
y -= 18;

text(
  "BoundRight compares insurance proposals against issued policies and produces discrepancy reports reviewed by your licensed agents. This page describes exactly what we store, what we delete, and where data lives.",
  10.5,
  { gap: 6 }
);
y -= 8;
rule();

section("What we process, then delete", [
  "Uploaded documents (proposals, binders, issued policies) are processed and deleted immediately after each check completes, on success and on failure alike.",
  "A nightly job independently verifies deletion and removes and flags any file older than 24 hours.",
  "Document text is sent to Anthropic's Claude API for extraction and comparison during processing only.",
]);

section("What we store", [
  "Account details (name, email), agency settings, and your ROI assumptions.",
  "Check labels and original file names (never file contents).",
  "Findings: field names, extracted values, page citations, short cited excerpts (about 240 characters each), severity, and your reviewers' decisions and notes.",
  "First-party usage events. No third-party analytics run in the product.",
]);

section("Where it lives, and who touches it", [
  "Database, authentication, and in-flight file storage: Supabase (Postgres), with row-level security isolating every agency and a private bucket with short-lived signed upload URLs.",
  "AI processing: Anthropic Claude API (document text during checks only).",
  "Payments: Stripe. Card data never touches BoundRight systems.",
  "Email: Resend, for transactional messages to your account addresses.",
  "Hosting: Vercel, HTTPS everywhere. Error monitoring: Sentry, scrubbed of document content and personal data.",
]);

section("Access, retention, deletion", [
  "Each agency's data is isolated by row-level security enforced in the database, not in application code.",
  "Exported reports carry the reviewing agent's name and date; the report is your work product.",
  "Cancel anytime: data stays read-only for 90 days, then is deleted after two warning emails.",
  "Delete your account in Settings at any time; the agency and all associated data are removed.",
]);

text("Questions: help@boundright.app", 10, { gap: 4 });
drawBrandFooter(page, { bold, regular: sans, mono: sans }, {
  pageWidth: 612,
  rightTag: "Minds Eye Collective",
});

const out = path.join(import.meta.dirname, "..", "public", "boundright-data-processing.pdf");
fs.writeFileSync(out, await doc.save());
console.log(`wrote ${out}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
