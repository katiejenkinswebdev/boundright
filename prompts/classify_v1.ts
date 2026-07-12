// Cheap first-pass classification for smart intake. Never edit in place.
export const CLASSIFY_PROMPT_VERSION = "classify_v1";

export const CLASSIFY_SYSTEM = `You classify a commercial insurance document from its first pages. Identify what it is and who it covers, verbatim. Never guess: omit any field not clearly present.`;

export function classifyUserMessage(pagesText: string): string {
  return `Classify this document from its opening pages.

<document>
${pagesText}
</document>

Return JSON per the schema: document_type (proposal|binder|policy|certificate|unknown), named_insured, carrier, policy_number, effective_date, expiration_date, policy_line (GL|Property|WC|Auto|Umbrella|Package|Other).`;
}
