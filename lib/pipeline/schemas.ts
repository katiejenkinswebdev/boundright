// Typed shapes + JSON schemas for the pipeline's structured outputs.
// Structured-output constraint: every object needs additionalProperties: false.

export type CitedValue = { value: string; page: number };

export type Extraction = {
  document_type: "proposal" | "binder" | "policy" | "certificate" | "unknown";
  named_insureds?: CitedValue[];
  effective_date?: CitedValue;
  expiration_date?: CitedValue;
  coverages?: {
    line: string;
    limits?: { name: string; value: string; page: number }[];
    deductibles?: { name: string; value: string; page: number }[];
  }[];
  forms_endorsements?: { number: string; title?: string; page: number }[];
  carrier?: CitedValue;
  premium?: CitedValue;
  extraction_notes?: string[];
};

export type FindingStatus =
  | "match"
  | "mismatch"
  | "not_found_in_policy"
  | "not_found_in_proposal";
export type Severity = "critical" | "moderate" | "minor";
export type Confidence = "high" | "medium" | "low";
export type Category =
  | "named_insured"
  | "dates"
  | "limits"
  | "deductibles"
  | "forms"
  | "premium"
  | "other";

export type PipelineFinding = {
  field_name: string;
  category: Category;
  status: FindingStatus;
  severity: Severity | null;
  expected_value: string | null;
  found_value: string | null;
  doc_a_page: number | null;
  doc_b_page: number | null;
  confidence: Confidence;
};

export type Verification = {
  verdict: "confirmed" | "rejected" | "corrected";
  explanation: string;
  corrected_finding: PipelineFinding | null;
};

const citedValue = {
  type: "object",
  properties: {
    value: { type: "string" },
    page: { type: "integer" },
  },
  required: ["value", "page"],
  additionalProperties: false,
} as const;

const namedValue = {
  type: "object",
  properties: {
    name: { type: "string" },
    value: { type: "string" },
    page: { type: "integer" },
  },
  required: ["name", "value", "page"],
  additionalProperties: false,
} as const;

export const EXTRACTION_SCHEMA = {
  type: "object",
  properties: {
    document_type: {
      type: "string",
      enum: ["proposal", "binder", "policy", "certificate", "unknown"],
    },
    named_insureds: { type: "array", items: citedValue },
    effective_date: citedValue,
    expiration_date: citedValue,
    coverages: {
      type: "array",
      items: {
        type: "object",
        properties: {
          line: { type: "string" },
          limits: { type: "array", items: namedValue },
          deductibles: { type: "array", items: namedValue },
        },
        required: ["line"],
        additionalProperties: false,
      },
    },
    forms_endorsements: {
      type: "array",
      items: {
        type: "object",
        properties: {
          number: { type: "string" },
          title: { type: "string" },
          page: { type: "integer" },
        },
        required: ["number", "page"],
        additionalProperties: false,
      },
    },
    carrier: citedValue,
    premium: citedValue,
    extraction_notes: { type: "array", items: { type: "string" } },
  },
  required: ["document_type"],
  additionalProperties: false,
} as const;

const findingSchema = {
  type: "object",
  properties: {
    field_name: { type: "string" },
    category: {
      type: "string",
      enum: [
        "named_insured",
        "dates",
        "limits",
        "deductibles",
        "forms",
        "premium",
        "other",
      ],
    },
    status: {
      type: "string",
      enum: ["match", "mismatch", "not_found_in_policy", "not_found_in_proposal"],
    },
    severity: {
      anyOf: [
        { type: "string", enum: ["critical", "moderate", "minor"] },
        { type: "null" },
      ],
    },
    expected_value: { anyOf: [{ type: "string" }, { type: "null" }] },
    found_value: { anyOf: [{ type: "string" }, { type: "null" }] },
    doc_a_page: { anyOf: [{ type: "integer" }, { type: "null" }] },
    doc_b_page: { anyOf: [{ type: "integer" }, { type: "null" }] },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
  },
  required: [
    "field_name",
    "category",
    "status",
    "severity",
    "expected_value",
    "found_value",
    "doc_a_page",
    "doc_b_page",
    "confidence",
  ],
  additionalProperties: false,
} as const;

export const FINDINGS_SCHEMA = {
  type: "object",
  properties: {
    findings: { type: "array", items: findingSchema },
  },
  required: ["findings"],
  additionalProperties: false,
} as const;

export const VERIFICATION_SCHEMA = {
  type: "object",
  properties: {
    verdict: { type: "string", enum: ["confirmed", "rejected", "corrected"] },
    explanation: { type: "string" },
    corrected_finding: { anyOf: [findingSchema, { type: "null" }] },
  },
  required: ["verdict", "explanation", "corrected_finding"],
  additionalProperties: false,
} as const;
