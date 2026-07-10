// Eval harness: runs the real pipeline (ingest -> extract -> compare ->
// verify) against the golden specimen pairs and scores findings against
// eval/expected/*.json. Run before every prompt or model change.
//
// Usage: npx tsx eval/run.ts            (requires ANTHROPIC_API_KEY)
//        CLAUDE_STUB_DIR=eval/stubs npx tsx eval/run.ts pair1   (plumbing only)
import fs from "node:fs";
import path from "node:path";
import { ingestPdf, excerptPages } from "../lib/pipeline/pdf";
import {
  extractFromText,
  compare,
  verifyCritical,
  emptyUsage,
  MODEL,
  PROMPT_VERSION,
} from "../lib/pipeline/claude";
import type { PipelineFinding } from "../lib/pipeline/schemas";

const EVAL_DIR = import.meta.dirname;
const onlyPair = process.argv[2];
const pairs = (onlyPair ? [onlyPair] : ["pair1", "pair2", "pair3"]).map((p) => ({
  name: p,
  proposal: path.join(EVAL_DIR, "specimens", `${p}_proposal.pdf`),
  policy: path.join(EVAL_DIR, "specimens", `${p}_policy.pdf`),
  expected: JSON.parse(
    fs.readFileSync(path.join(EVAL_DIR, "expected", `${p}.json`), "utf8")
  ) as Expected,
}));

type ExpectedFinding = { category: string; field_match: string; status: string };
type Expected = {
  criticals: ExpectedFinding[];
  moderates: ExpectedFinding[];
  minors: ExpectedFinding[];
};

function matches(finding: PipelineFinding, exp: ExpectedFinding): boolean {
  const haystack = `${finding.field_name} ${finding.expected_value ?? ""} ${finding.found_value ?? ""}`.toLowerCase();
  return (
    finding.category === exp.category &&
    finding.status === exp.status &&
    haystack.includes(exp.field_match)
  );
}

let failures = 0;
const usage = emptyUsage();

async function main() {
console.log(`Eval — model ${MODEL}, prompts ${PROMPT_VERSION}\n`);

for (const pair of pairs) {
  console.log(`── ${pair.name} ─────────────────────────────`);
  const [ingA, ingB] = await Promise.all(
    [pair.proposal, pair.policy].map(async (file) =>
      ingestPdf(new Uint8Array(fs.readFileSync(file)))
    )
  );
  if (!ingA.ok || !ingB.ok) throw new Error(`${pair.name}: specimen failed to ingest`);

  const [extractionA, extractionB] = await Promise.all([
    extractFromText(ingA.pagesText, usage),
    extractFromText(ingB.pagesText, usage),
  ]);

  let findings = await compare(extractionA, extractionB, usage);

  // Same verify pass as production.
  findings = await Promise.all(
    findings.map(async (f) => {
      if (f.severity !== "critical") return f;
      const v = await verifyCritical(
        f,
        excerptPages(ingA.pages, f.doc_a_page),
        excerptPages(ingB.pages, f.doc_b_page),
        usage
      );
      if (v.verdict === "corrected" && v.corrected_finding) return v.corrected_finding;
      if (v.verdict === "rejected") return { ...f, confidence: "low" as const };
      return f;
    })
  );

  const produced = {
    critical: findings.filter((f) => f.severity === "critical" && f.status !== "match"),
    moderate: findings.filter((f) => f.severity === "moderate" && f.status !== "match"),
    minor: findings.filter((f) => f.severity === "minor" && f.status !== "match"),
  };

  // Recall on seeded criticals — every one must be found, as critical.
  for (const exp of pair.expected.criticals) {
    const hit = produced.critical.find((f) => matches(f, exp));
    console.log(
      `${hit ? "PASS" : "FAIL"}  critical found: ${exp.category}/${exp.field_match}`
    );
    if (!hit) failures++;
  }

  // Precision on criticals — zero false criticals allowed.
  const falseCriticals = produced.critical.filter(
    (f) => !pair.expected.criticals.some((exp) => matches(f, exp))
  );
  console.log(
    `${falseCriticals.length === 0 ? "PASS" : "FAIL"}  zero false criticals (got ${falseCriticals.length})`
  );
  if (falseCriticals.length > 0) {
    failures++;
    for (const f of falseCriticals) {
      console.log(`       false critical: [${f.category}] ${f.field_name}: ${f.expected_value} vs ${f.found_value}`);
    }
  }

  // Moderates: report recall, non-blocking.
  for (const exp of pair.expected.moderates) {
    const hit = produced.moderate.find((f) => matches(f, exp));
    console.log(`${hit ? "PASS" : "warn"}  moderate found: ${exp.category}/${exp.field_match}`);
  }

  console.log(
    `      findings: ${findings.length} total, ${produced.critical.length} critical, ${produced.moderate.length} moderate, ${produced.minor.length} minor\n`
  );
}

console.log(
  `Tokens: ${usage.tokensIn} in / ${usage.tokensOut} out — est. cost $${(usage.costCents / 100).toFixed(2)}`
);
console.log(failures === 0 ? "\nEVAL PASSED" : `\nEVAL FAILED: ${failures} blocking failures`);
process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
