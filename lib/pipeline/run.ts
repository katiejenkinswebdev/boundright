import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { ingestPdf, excerptPages, type PdfIngestResult } from "./pdf";
import {
  extractFromText,
  extractFromScanned,
  compare,
  verifyCritical,
  emptyUsage,
  MODEL,
  promptVersionFor,
  MAX_VISION_PAGES,
  type CheckType,
} from "./claude";
import type { PipelineFinding } from "./schemas";
import { sendCheckReadyEmail } from "@/lib/email";
import { notifyAgency } from "@/lib/notify";
import { auditLog } from "@/lib/audit";

/**
 * A short source excerpt around the cited value: the citation preview that
 * survives document deletion. ~240 chars, centered on the value when found.
 */
export function citationExcerpt(
  pages: string[],
  page: number | null,
  value: string | null
): string | null {
  if (page === null || page < 1 || page > pages.length) return null;
  const text = pages[page - 1].replace(/\s+/g, " ").trim();
  if (!text) return null;
  const idx = value ? text.indexOf(value) : -1;
  if (idx >= 0) {
    const start = Math.max(0, idx - 100);
    const end = Math.min(text.length, idx + value!.length + 100);
    return `${start > 0 ? "…" : ""}${text.slice(start, end)}${end < text.length ? "…" : ""}`;
  }
  return text.slice(0, 240) + (text.length > 240 ? "…" : "");
}

export function docPaths(checkId: string) {
  return {
    a: `checks/${checkId}/doc_a.pdf`,
    b: `checks/${checkId}/doc_b.pdf`,
  };
}

// Plain-language failure copy (spec 4.2): state what went wrong and the fix.
const FAILURE_COPY: Record<string, string> = {
  password_protected:
    "This PDF is password-protected. Remove the password and re-upload.",
  not_a_pdf:
    "That file isn't a readable PDF. Export it as PDF and try again.",
  too_many_pages: `This document is over 300 pages. Split it and check the relevant sections separately.`,
  too_many_scanned_pages: `One of the documents is a scanned image over ${MAX_VISION_PAGES} pages. BoundRight can read scans up to ${MAX_VISION_PAGES} pages — split the document and try again.`,
  download_failed: "We couldn't read the uploaded files. Upload them again.",
  identical_files:
    "Both uploads are the same file. Upload the proposal or source document as Document A and the issued policy as Document B.",
  not_insurance_a:
    "Document A doesn't look like an insurance document. We couldn't find policy fields (named insured, dates, limits, premium) in it. Emails, letters, and other attachments can't be checked — upload the proposal, binder, or policy itself.",
  not_insurance_b:
    "Document B doesn't look like an insurance document. We couldn't find policy fields (named insured, dates, limits, premium) in it. Emails, letters, and other attachments can't be checked — upload the proposal, binder, or policy itself.",
};

/** Input-quality gate: how many recognizable policy fields the extraction found. */
function fieldYield(e: import("./schemas").Extraction): number {
  return (
    (e.named_insureds?.length ? 1 : 0) +
    (e.effective_date ? 1 : 0) +
    (e.expiration_date ? 1 : 0) +
    (e.carrier ? 1 : 0) +
    (e.premium ? 1 : 0) +
    (e.coverages?.reduce((s, c) => s + (c.limits?.length ?? 0) + (c.deductibles?.length ?? 0), 0) ?? 0) +
    (e.forms_endorsements?.length ?? 0)
  );
}

type DocSide = "a" | "b";

/**
 * Runs the full pipeline for a queued check. Always deletes the uploaded
 * PDFs before returning, success or failure. Failed checks do not count
 * against the monthly cap.
 */
export async function runCheck(checkId: string): Promise<void> {
  const admin = createAdminClient();
  if (!admin) throw new Error("Supabase not configured");

  const paths = docPaths(checkId);
  const usage = emptyUsage();

  const fail = async (reason: string) => {
    await admin
      .from("checks")
      .update({ status: "failed", failure_reason: reason })
      .eq("id", checkId);
    const { data: c2 } = await admin.from("checks").select("agency_id, label").eq("id", checkId).single();
    if (c2) await auditLog({ agencyId: c2.agency_id, checkId, checkLabel: c2.label, action: "processing_failed", detail: { reason } });
  };

  try {
    const { data: check } = await admin
      .from("checks")
      .select("id, agency_id, label, check_type, agencies(premium_variance_threshold, renewal_premium_threshold)")
      .eq("id", checkId)
      .single();
    if (!check) return;

    await admin.from("checks").update({ status: "extracting" }).eq("id", checkId);
    await auditLog({ agencyId: check.agency_id, checkId, checkLabel: check.label, action: "processing_started" });

    // --- Ingest both documents ---
    const docs: Record<DocSide, { bytes: Uint8Array; sha256: string; ingest: PdfIngestResult }> =
      {} as never;
    for (const side of ["a", "b"] as DocSide[]) {
      const { data: blob, error } = await admin.storage
        .from("documents")
        .download(paths[side]);
      if (error || !blob) {
        await fail(FAILURE_COPY.download_failed);
        return;
      }
      const bytes = new Uint8Array(await blob.arrayBuffer());
      // Hash first and hand pdf.js a copy: it transfers (detaches) the
      // buffer it is given, which silently empties `bytes` afterward.
      const sha256 = createHash("sha256").update(bytes).digest("hex");
      const ingest = await ingestPdf(bytes.slice());
      if (!ingest.ok) {
        await fail(FAILURE_COPY[ingest.reason]);
        return;
      }
      if (ingest.scanned && ingest.pageCount > MAX_VISION_PAGES) {
        await fail(FAILURE_COPY.too_many_scanned_pages);
        return;
      }
      docs[side] = { bytes, sha256, ingest };
    }

    const ingestA = docs.a.ingest as Extract<PdfIngestResult, { ok: true }>;
    const ingestB = docs.b.ingest as Extract<PdfIngestResult, { ok: true }>;

    // Same file twice produces a report full of matches that means nothing.
    if (docs.a.sha256 === docs.b.sha256) {
      await fail(FAILURE_COPY.identical_files);
      return;
    }
    await admin
      .from("checks")
      .update({
        doc_a_scanned: ingestA.scanned,
        doc_b_scanned: ingestB.scanned,
        doc_a_sha256: docs.a.sha256,
        doc_b_sha256: docs.b.sha256,
        doc_a_pages: ingestA.pageCount,
        doc_b_pages: ingestB.pageCount,
      })
      .eq("id", checkId);

    // --- Extract ---
    const [extractionA, extractionB] = await Promise.all(
      (["a", "b"] as DocSide[]).map((side) => {
        const { bytes, ingest } = docs[side];
        const okIngest = ingest as Extract<PdfIngestResult, { ok: true }>;
        return okIngest.scanned
          ? extractFromScanned(Buffer.from(bytes).toString("base64"), usage)
          : extractFromText(okIngest.pagesText, usage);
      })
    );

    // Input-quality gate: an email, memo, or blank page extracts almost
    // nothing. Fail with a pointed message instead of producing a junk
    // report ("quality in, quality out").
    const MIN_FIELDS = 3;
    if (extractionA.document_type === "unknown" && fieldYield(extractionA) < MIN_FIELDS) {
      await fail(FAILURE_COPY.not_insurance_a);
      return;
    }
    if (extractionB.document_type === "unknown" && fieldYield(extractionB) < MIN_FIELDS) {
      await fail(FAILURE_COPY.not_insurance_b);
      return;
    }

    // --- Compare ---
    await admin.from("checks").update({ status: "comparing" }).eq("id", checkId);
    const checkType = (check.check_type ?? "issuance") as CheckType;
    const agencyCfg = check.agencies as unknown as {
      premium_variance_threshold: number;
      renewal_premium_threshold: number;
    } | null;
    let findings = await compare(extractionA, extractionB, usage, checkType, {
      premiumPct: Number(agencyCfg?.premium_variance_threshold ?? 5),
      renewalPremiumPct: Number(agencyCfg?.renewal_premium_threshold ?? 10),
    });

    // --- Verify criticals (second pass) ---
    const verified: PipelineFinding[] = [];
    for (const finding of findings) {
      if (finding.severity !== "critical") {
        verified.push(finding);
        continue;
      }
      const verdict = await verifyCritical(
        finding,
        excerptPages(ingestA.pages, finding.doc_a_page),
        excerptPages(ingestB.pages, finding.doc_b_page),
        usage
      );
      if (verdict.verdict === "corrected" && verdict.corrected_finding) {
        verified.push(verdict.corrected_finding);
      } else if (verdict.verdict === "rejected") {
        // Disagreement between passes: keep the finding, downgrade confidence.
        verified.push({ ...finding, confidence: "low" });
      } else {
        verified.push(finding);
      }
    }
    findings = verified;

    // --- Persist findings ---
    const { error: insertError } = await admin.from("findings").insert(
      findings.map((f) => ({
        check_id: checkId,
        agency_id: check.agency_id,
        field_name: f.field_name,
        category: f.category,
        status: f.status,
        severity: f.status === "match" ? null : f.severity,
        expected_value: f.expected_value,
        found_value: f.found_value,
        doc_a_page: f.doc_a_page,
        doc_b_page: f.doc_b_page,
        confidence: f.confidence,
        doc_a_excerpt: citationExcerpt(ingestA.pages, f.doc_a_page, f.expected_value),
        doc_b_excerpt: citationExcerpt(ingestB.pages, f.doc_b_page, f.found_value),
      }))
    );
    if (insertError) throw insertError;

    await admin
      .from("checks")
      .update({
        status: "ready_for_review",
        processed_at: new Date().toISOString(),
        model_version: MODEL,
        prompt_version: promptVersionFor(checkType),
        carrier: extractionB.carrier?.value ?? extractionA.carrier?.value ?? null,
        tokens_in: usage.tokensIn,
        tokens_out: usage.tokensOut,
        cost_cents: Math.round(usage.costCents),
      })
      .eq("id", checkId);

    // Successful checks count against the cap; failed ones don't, and the
    // bundled sample check (created only by runSampleCheck) is free.
    if (!check.label.startsWith("Sample:")) {
      await admin.rpc("increment_checks_this_period", {
        p_agency_id: check.agency_id,
      });
    }

    await admin.from("events").insert({
      agency_id: check.agency_id,
      event_name: "check_run",
      metadata: { check_id: checkId, cost_cents: Math.round(usage.costCents) },
    });

    // Cost guardrail: any single check over $2 of API cost gets flagged.
    if (usage.costCents > 200) {
      await admin.from("events").insert({
        agency_id: check.agency_id,
        event_name: "cost_guardrail_check",
        metadata: { check_id: checkId, cost_cents: Math.round(usage.costCents) },
      });
    }

    await auditLog({
      agencyId: check.agency_id,
      checkId,
      checkLabel: check.label,
      action: "results_ready",
      detail: {
        findings: findings.length,
        critical: findings.filter((x) => x.severity === "critical" && x.status !== "match").length,
        moderate: findings.filter((x) => x.severity === "moderate" && x.status !== "match").length,
        minor: findings.filter((x) => x.severity === "minor" && x.status !== "match").length,
        model: MODEL,
        prompt_version: promptVersionFor(checkType),
      },
    });
    await sendCheckReadyEmail(check.agency_id, checkId, check.label);
    await notifyAgency(
      check.agency_id,
      `BoundRight: the check for "${check.label}" is ready for review.`
    );
  } catch (err) {
    console.error(`Check ${checkId} failed:`, err instanceof Error ? err.message : err);
    await fail(
      "Something went wrong while processing these documents. Try again — this check didn't count against your limit."
    );
  } finally {
    // The privacy promise: documents are deleted no matter what happened.
    await admin.storage.from("documents").remove([paths.a, paths.b]);
  }
}
