import Anthropic from "@anthropic-ai/sdk";
import fs from "node:fs";
import path from "node:path";
import {
  EXTRACTION_SCHEMA,
  FINDINGS_SCHEMA,
  VERIFICATION_SCHEMA,
  type Extraction,
  type PipelineFinding,
  type Verification,
} from "./schemas";
import { EXTRACT_SYSTEM, extractUserMessage, EXTRACT_PROMPT_VERSION } from "@/prompts/extract_v1";
import { COMPARE_SYSTEM, compareUserMessage, COMPARE_PROMPT_VERSION } from "@/prompts/compare_v1";
import { VERIFY_SYSTEM, verifyUserMessage, VERIFY_PROMPT_VERSION } from "@/prompts/verify_v1";

export const MODEL = "claude-sonnet-5";
export const PROMPT_VERSION = `${EXTRACT_PROMPT_VERSION}+${COMPARE_PROMPT_VERSION}+${VERIFY_PROMPT_VERSION}`;

// claude-sonnet-5: $3/MTok in, $15/MTok out.
const INPUT_CENTS_PER_MTOK = 300;
const OUTPUT_CENTS_PER_MTOK = 1500;
/** Scanned docs go to Claude as a PDF document block (vision); cap per spec. */
export const MAX_VISION_PAGES = 100;

export type Usage = { tokensIn: number; tokensOut: number; costCents: number };

export function emptyUsage(): Usage {
  return { tokensIn: 0, tokensOut: 0, costCents: 0 };
}

function addUsage(total: Usage, u: Anthropic.Usage): void {
  const tokensIn =
    u.input_tokens +
    (u.cache_creation_input_tokens ?? 0) +
    (u.cache_read_input_tokens ?? 0);
  total.tokensIn += tokensIn;
  total.tokensOut += u.output_tokens;
  total.costCents +=
    (tokensIn * INPUT_CENTS_PER_MTOK + u.output_tokens * OUTPUT_CENTS_PER_MTOK) /
    1_000_000;
}

const client = new Anthropic();

// ---------------------------------------------------------------------------
// Stub mode: CLAUDE_STUB_DIR lets tests exercise the whole pipeline without an
// API key. Inputs carry a "BR-STUB:<key>" marker; responses come from
// <dir>/<key>.json. Never set in production.
// ---------------------------------------------------------------------------
function stubResponse<T>(input: string): T | null {
  const dir = process.env.CLAUDE_STUB_DIR;
  if (!dir) return null;
  const match = input.match(/BR-STUB:([\w-]+)/);
  if (!match) throw new Error(`Stub mode active but no BR-STUB key in input`);
  const file = path.join(dir, `${match[1]}.json`);
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

async function structuredCall<T>(
  system: string,
  content: Anthropic.ContentBlockParam[],
  schema: Record<string, unknown>,
  usage: Usage
): Promise<T> {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 16000,
    system,
    messages: [{ role: "user", content }],
    output_config: { format: { type: "json_schema", schema } },
  });
  addUsage(usage, response.usage);
  if (response.stop_reason === "refusal") {
    throw new Error("Model declined to process this document.");
  }
  if (response.stop_reason === "max_tokens") {
    throw new Error("Document too complex: output limit reached.");
  }
  const text = response.content.find((b) => b.type === "text")?.text;
  if (!text) throw new Error("Empty model response.");
  return JSON.parse(text) as T;
}

/** Extract structured data from a text-layer document. */
export async function extractFromText(
  pagesText: string,
  usage: Usage
): Promise<Extraction> {
  const stub = stubResponse<Extraction>(pagesText);
  if (stub) return stub;
  return structuredCall<Extraction>(
    EXTRACT_SYSTEM,
    [{ type: "text", text: extractUserMessage(pagesText) }],
    EXTRACTION_SCHEMA,
    usage
  );
}

/** Extract from a scanned document: ship the PDF itself for vision. */
export async function extractFromScanned(
  pdfBase64: string,
  usage: Usage
): Promise<Extraction> {
  return structuredCall<Extraction>(
    EXTRACT_SYSTEM,
    [
      {
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: pdfBase64 },
      },
      {
        type: "text",
        text: extractUserMessage(
          "(Scanned document attached as PDF — read it visually, page numbers are the PDF page numbers.)"
        ),
      },
    ],
    EXTRACTION_SCHEMA,
    usage
  );
}

export async function compare(
  proposal: Extraction,
  policy: Extraction,
  usage: Usage
): Promise<PipelineFinding[]> {
  const proposalJson = JSON.stringify(proposal, null, 2);
  const policyJson = JSON.stringify(policy, null, 2);
  const stub = stubResponse<{ findings: PipelineFinding[] }>(proposalJson + policyJson);
  if (stub) return stub.findings;
  const result = await structuredCall<{ findings: PipelineFinding[] }>(
    COMPARE_SYSTEM,
    [{ type: "text", text: compareUserMessage(proposalJson, policyJson) }],
    FINDINGS_SCHEMA,
    usage
  );
  return result.findings;
}

/** Second pass on a critical finding. Cheap insurance against false criticals. */
export async function verifyCritical(
  finding: PipelineFinding,
  docAExcerpt: string,
  docBExcerpt: string,
  usage: Usage
): Promise<Verification> {
  if (process.env.CLAUDE_STUB_DIR) {
    return { verdict: "confirmed", explanation: "stub", corrected_finding: null };
  }
  return structuredCall<Verification>(
    VERIFY_SYSTEM,
    [
      {
        type: "text",
        text: verifyUserMessage(JSON.stringify(finding, null, 2), docAExcerpt, docBExcerpt),
      },
    ],
    VERIFICATION_SCHEMA,
    usage
  );
}
