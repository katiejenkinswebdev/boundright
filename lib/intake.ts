import type { Classification } from "@/lib/pipeline/claude";

export type ClassifiedDoc = Classification & {
  path: string;
  filename: string;
  scanned: boolean;
};

export type ProposedPair = {
  a: ClassifiedDoc; // source: proposal/binder, certificate, or expiring policy
  b: ClassifiedDoc; // issued/underlying/renewal policy
  checkType: "issuance" | "renewal" | "coi";
  label: string;
  policyType: string;
  confidence: "high" | "medium" | "low";
};

export type PairingResult = { pairs: ProposedPair[]; orphans: ClassifiedDoc[] };

/** Normalize an insured name for matching: case, punctuation, entity suffixes. */
export function normalizeInsured(name?: string): string {
  return (name ?? "")
    .toLowerCase()
    .replace(/[.,']/g, "")
    .replace(/\b(llc|inc|co|corp|corporation|company|ltd)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const LINES = ["GL", "Property", "WC", "Auto", "Umbrella", "Package"];

/**
 * Propose document pairs by insured + document roles. The AI proposes,
 * a human confirms: nothing here runs a check by itself.
 */
export function pairDocuments(docs: ClassifiedDoc[]): PairingResult {
  const remaining = [...docs];
  const pairs: ProposedPair[] = [];

  const take = (pred: (d: ClassifiedDoc) => boolean): ClassifiedDoc | undefined => {
    const i = remaining.findIndex(pred);
    return i >= 0 ? remaining.splice(i, 1)[0] : undefined;
  };

  // Group by normalized insured; loosely matched groups lower confidence.
  const insureds = [...new Set(remaining.map((d) => normalizeInsured(d.named_insured)).filter(Boolean))];

  for (const insured of insureds) {
    const sameInsured = (d: ClassifiedDoc) => normalizeInsured(d.named_insured) === insured;
    for (;;) {
      const source = take(
        (d) => sameInsured(d) && (d.document_type === "proposal" || d.document_type === "binder")
      );
      if (source) {
        const policy = take((d) => sameInsured(d) && d.document_type === "policy");
        if (!policy) {
          remaining.push(source);
          break;
        }
        const lineMatch = !source.policy_line || !policy.policy_line || source.policy_line === policy.policy_line;
        pairs.push({
          a: source,
          b: policy,
          checkType: "issuance",
          label: `${source.named_insured ?? "Account"} ${policy.policy_line ?? source.policy_line ?? ""}`.trim(),
          policyType: LINES.includes(policy.policy_line ?? "") ? policy.policy_line! : "Other",
          confidence: lineMatch && source.effective_date ? "high" : "medium",
        });
        continue;
      }
      const cert = take((d) => sameInsured(d) && d.document_type === "certificate");
      if (cert) {
        const policy = take((d) => sameInsured(d) && d.document_type === "policy");
        if (!policy) {
          remaining.push(cert);
          break;
        }
        pairs.push({
          a: cert,
          b: policy,
          checkType: "coi",
          label: `${cert.named_insured ?? "Account"} COI`,
          policyType: LINES.includes(policy.policy_line ?? "") ? policy.policy_line! : "Other",
          confidence: "medium",
        });
        continue;
      }
      // Two policies, same insured, same line, different terms → renewal.
      const p1 = take((d) => sameInsured(d) && d.document_type === "policy");
      if (p1) {
        const p2 = take(
          (d) =>
            sameInsured(d) &&
            d.document_type === "policy" &&
            (!d.policy_line || !p1.policy_line || d.policy_line === p1.policy_line) &&
            d.effective_date !== p1.effective_date
        );
        if (!p2) {
          remaining.push(p1);
          break;
        }
        const [expiring, renewal] =
          (p1.effective_date ?? "") <= (p2.effective_date ?? "") ? [p1, p2] : [p2, p1];
        pairs.push({
          a: expiring,
          b: renewal,
          checkType: "renewal",
          label: `${expiring.named_insured ?? "Account"} ${renewal.policy_line ?? ""} Renewal`.trim(),
          policyType: LINES.includes(renewal.policy_line ?? "") ? renewal.policy_line! : "Other",
          confidence: expiring.effective_date && renewal.effective_date ? "high" : "low",
        });
        continue;
      }
      break;
    }
  }

  return { pairs, orphans: remaining };
}
