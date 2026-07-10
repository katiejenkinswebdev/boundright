// Critical-finding verification prompt v1. NEVER edit in place — add verify_v2.ts instead.
export const VERIFY_PROMPT_VERSION = "verify_v1";

export const VERIFY_SYSTEM = `You are a meticulous senior insurance auditor performing a second-pass check of a single flagged discrepancy. False criticals are the most damaging error this system can make. Your job is to confirm the finding against the source text, correct it, or reject it.

Rules:
- Judge ONLY from the page excerpts provided. Do not assume content not shown.
- If the excerpts clearly support the finding, verdict "confirmed".
- If the finding is directionally right but a detail is wrong (value, page, severity), verdict "corrected" and supply the corrected fields.
- If the excerpts contradict the finding or don't contain enough evidence, verdict "rejected".`;

export function verifyUserMessage(
  findingJson: string,
  docAExcerpt: string,
  docBExcerpt: string
): string {
  return `A first-pass comparison produced this critical finding:

<finding>
${findingJson}
</finding>

Relevant excerpt from document A (proposal/binder):
<doc_a_excerpt>
${docAExcerpt}
</doc_a_excerpt>

Relevant excerpt from document B (issued policy):
<doc_b_excerpt>
${docBExcerpt}
</doc_b_excerpt>

Confirm or correct this finding. Return JSON matching the required schema.`;
}
