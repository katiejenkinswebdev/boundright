/** One place for what each severity means; every tooltip reads from here. */
export const SEVERITY_DEF = {
  critical:
    "Wrong named insured, limits, deductibles, dates, or a missing form or endorsement.",
  moderate:
    "Premium variance over your agency's threshold, or form edition-date changes.",
  minor: "Formatting differences and small premium variance.",
} as const;

export type Severity = keyof typeof SEVERITY_DEF;

/** Reviewer decisions, matches, and confidence — same idea, one source. */
export const TERM_DEF = {
  confirmed:
    "A licensed reviewer checked this finding against the source documents and confirmed the discrepancy is real. Confirmed findings drive metrics, letters, and reports.",
  dismissed:
    "A reviewer decided this finding is not an actionable discrepancy (with a recorded reason, like a known intentional change or an extraction error).",
  matches:
    "Fields where the proposal and the issued policy agree exactly. No action needed; they are listed in the report as verified.",
  ai: "AI finding, awaiting a human decision. Nothing counts until a reviewer confirms or dismisses it.",
  ai_draft: "AI-drafted from your confirmed findings. Review and edit before sending.",
} as const;

/**
 * The general AI safety statement (industry standard). Surfaces where the
 * user edits and sends AI output add the action sentence themselves.
 */
export const AI_SAFETY = "AI can make mistakes. Verify important information.";

export const CONFIDENCE_DEF = {
  high: "The extraction is unambiguous: the value was read cleanly from both documents.",
  medium:
    "The extraction is probably right but the source was less clear (layout, wording, or scan quality). Worth a glance at the excerpt.",
  low: "The source was hard to read (often a scanned image). Verify this value against the original document before acting on it.",
} as const;

export const STATUS_DEF: Record<string, string> = {
  queued: "Waiting its turn; processing starts within seconds.",
  extracting: "The AI is reading both PDFs and pulling out every comparable field.",
  comparing:
    "Field-by-field comparison is running, plus a second verification pass on anything critical.",
  ready_for_review:
    "The AI report is ready. A licensed reviewer needs to confirm or dismiss each finding.",
  reviewed: "A reviewer made every decision and marked the check complete.",
  failed:
    "The check could not finish; the reason is shown on the check. Failed checks never count against your allowance.",
};

export function confidenceTip(level: string): string {
  return (
    (CONFIDENCE_DEF as Record<string, string>)[level] ??
    "How sure the extraction is; low means verify against the source document."
  );
}
