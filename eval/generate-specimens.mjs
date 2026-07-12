// Generates the golden specimen document pairs (real text-layer PDFs) plus
// the expected-findings files the eval harness scores against.
// Usage: node eval/generate-specimens.mjs
import { PDFDocument, StandardFonts } from "pdf-lib";
import fs from "node:fs";
import path from "node:path";

const OUT = path.join(import.meta.dirname, "specimens");
fs.mkdirSync(OUT, { recursive: true });

async function makePdf(file, pages) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Courier);
  const bold = await doc.embedFont(StandardFonts.CourierBold);
  for (const lines of pages) {
    const page = doc.addPage([612, 792]);
    let y = 740;
    for (const line of lines) {
      const isHeading = line === line.toUpperCase() && line.trim() !== "" && y === 740;
      page.drawText(line, {
        x: 50,
        y,
        size: isHeading ? 13 : 10,
        font: isHeading ? bold : font,
      });
      y -= 18;
    }
  }
  fs.writeFileSync(path.join(OUT, file), await doc.save());
  console.log(`wrote ${file}`);
}

// --- Pair 1: Acme Manufacturing — GL renewal -------------------------------
// Seeded: General Aggregate $2M -> $1M (critical), CG 20 37 04 13 missing
// from policy (critical), premium $14,250 -> $14,890 (+4.5%, minor).
await makePdf("pair1_proposal.pdf", [
  [
    "PROPOSAL OF INSURANCE",
    "",
    "Presented by: Hartwell Insurance Group",
    "Reference: BR-STUB:pair1-a",
    "",
    "Named Insured: Acme Manufacturing, Inc.",
    "Mailing Address: 1200 Industrial Pkwy, Dayton, OH 45402",
    "",
    "Proposed Effective Date: 01/01/2026",
    "Proposed Expiration Date: 01/01/2027",
    "",
    "Total Estimated Annual Premium: $14,250",
  ],
  [
    "COMMERCIAL GENERAL LIABILITY - PROPOSED LIMITS",
    "",
    "Each Occurrence Limit:                       $1,000,000",
    "General Aggregate Limit:                     $2,000,000",
    "Products/Completed Operations Aggregate:     $2,000,000",
    "Personal & Advertising Injury Limit:         $1,000,000",
    "Damage to Premises Rented to You:            $100,000",
    "Medical Expense Limit:                       $5,000",
    "",
    "Deductible: $2,500 per claim (Bodily Injury & Property Damage)",
  ],
  [
    "SCHEDULE OF FORMS AND ENDORSEMENTS - PROPOSED",
    "",
    "CG 00 01 04 13   Commercial General Liability Coverage Form",
    "CG 20 10 04 13   Additional Insured - Owners, Lessees or",
    "                 Contractors - Scheduled Person or Organization",
    "CG 20 37 04 13   Additional Insured - Owners, Lessees or",
    "                 Contractors - Completed Operations",
    "IL 00 17 11 98   Common Policy Conditions",
  ],
]);

await makePdf("pair1_policy.pdf", [
  [
    "COMMERCIAL GENERAL LIABILITY POLICY",
    "",
    "Issuing Carrier: Midwest Casualty Insurance Company",
    "Policy Number: GL-2026-448812",
    "Reference: BR-STUB:pair1-b",
    "",
    "Named Insured: Acme Manufacturing, Inc.",
    "Mailing Address: 1200 Industrial Pkwy, Dayton, OH 45402",
    "",
    "Policy Period: From 01/01/2026 to 01/01/2027",
    "",
    "Total Annual Premium: $14,890",
  ],
  [
    "DECLARATIONS - LIMITS OF INSURANCE",
    "",
    "Each Occurrence Limit:                       $1,000,000",
    "General Aggregate Limit:                     $1,000,000",
    "Products/Completed Operations Aggregate:     $2,000,000",
    "Personal & Advertising Injury Limit:         $1,000,000",
    "Damage to Premises Rented to You:            $100,000",
    "Medical Expense Limit:                       $5,000",
    "",
    "Deductible: $2,500 per claim (Bodily Injury & Property Damage)",
  ],
  [
    "SCHEDULE OF FORMS AND ENDORSEMENTS",
    "",
    "CG 00 01 04 13   Commercial General Liability Coverage Form",
    "CG 20 10 04 13   Additional Insured - Owners, Lessees or",
    "                 Contractors - Scheduled Person or Organization",
    "IL 00 17 11 98   Common Policy Conditions",
  ],
]);

// --- Pair 2: Harbor View Restaurants — Property ----------------------------
// Seeded: expiration 03/15/2027 -> 09/15/2026 (critical), deductible
// $2,500 -> $5,000 (critical), CP 10 30 edition 10 12 -> 06 07 (moderate).
await makePdf("pair2_proposal.pdf", [
  [
    "PROPOSAL OF INSURANCE - COMMERCIAL PROPERTY",
    "",
    "Presented by: Hartwell Insurance Group",
    "Reference: BR-STUB:pair2-a",
    "",
    "Named Insured: Harbor View Restaurants LLC",
    "Premises: 88 Waterfront Ave, Portsmouth, NH 03801",
    "",
    "Proposed Effective Date: 03/15/2026",
    "Proposed Expiration Date: 03/15/2027",
    "",
    "Total Estimated Annual Premium: $21,600",
  ],
  [
    "PROPOSED PROPERTY LIMITS",
    "",
    "Building Limit:                              $2,500,000",
    "Business Personal Property:                  $750,000",
    "Business Income w/ Extra Expense:            $500,000",
    "",
    "Deductible: $2,500 per occurrence",
    "Cause of Loss: Special Form",
  ],
  [
    "SCHEDULE OF FORMS AND ENDORSEMENTS - PROPOSED",
    "",
    "CP 00 10 10 12   Building and Personal Property Coverage Form",
    "CP 10 30 10 12   Causes of Loss - Special Form",
    "IL 00 17 11 98   Common Policy Conditions",
  ],
]);

await makePdf("pair2_policy.pdf", [
  [
    "COMMERCIAL PROPERTY POLICY",
    "",
    "Issuing Carrier: Granite State Mutual",
    "Policy Number: CP-2026-90233",
    "Reference: BR-STUB:pair2-b",
    "",
    "Named Insured: Harbor View Restaurants LLC",
    "Premises: 88 Waterfront Ave, Portsmouth, NH 03801",
    "",
    "Policy Period: From 03/15/2026 to 09/15/2026",
    "",
    "Total Annual Premium: $21,600",
  ],
  [
    "DECLARATIONS - PROPERTY LIMITS",
    "",
    "Building Limit:                              $2,500,000",
    "Business Personal Property:                  $750,000",
    "Business Income w/ Extra Expense:            $500,000",
    "",
    "Deductible: $5,000 per occurrence",
    "Cause of Loss: Special Form",
  ],
  [
    "SCHEDULE OF FORMS AND ENDORSEMENTS",
    "",
    "CP 00 10 10 12   Building and Personal Property Coverage Form",
    "CP 10 30 06 07   Causes of Loss - Special Form",
    "IL 00 17 11 98   Common Policy Conditions",
  ],
]);

// --- Pair 3: Summit Trucking — Commercial Auto -----------------------------
// Seeded: named insured "LLC" -> "Co." (critical), premium $32,000 ->
// $34,700 (+8.4%, moderate). Everything else matches.
await makePdf("pair3_proposal.pdf", [
  [
    "PROPOSAL OF INSURANCE - COMMERCIAL AUTO",
    "",
    "Presented by: Hartwell Insurance Group",
    "Reference: BR-STUB:pair3-a",
    "",
    "Named Insured: Summit Trucking LLC",
    "Garaging Address: 450 Freight Rd, Boise, ID 83716",
    "",
    "Proposed Effective Date: 06/01/2026",
    "Proposed Expiration Date: 06/01/2027",
    "",
    "Total Estimated Annual Premium: $32,000",
  ],
  [
    "PROPOSED AUTO COVERAGES",
    "",
    "Combined Single Limit (Liability):           $1,000,000",
    "Uninsured/Underinsured Motorist:             $1,000,000",
    "Comprehensive Deductible:                    $1,000",
    "Collision Deductible:                        $1,000",
    "",
    "Covered Autos: Symbols 1, 8, 9",
  ],
  [
    "SCHEDULE OF FORMS AND ENDORSEMENTS - PROPOSED",
    "",
    "CA 00 01 11 20   Business Auto Coverage Form",
    "IL 00 17 11 98   Common Policy Conditions",
  ],
]);

await makePdf("pair3_policy.pdf", [
  [
    "BUSINESS AUTO POLICY",
    "",
    "Issuing Carrier: Cascade National Insurance",
    "Policy Number: CA-2026-71145",
    "Reference: BR-STUB:pair3-b",
    "",
    "Named Insured: Summit Trucking Co.",
    "Garaging Address: 450 Freight Rd, Boise, ID 83716",
    "",
    "Policy Period: From 06/01/2026 to 06/01/2027",
    "",
    "Total Annual Premium: $34,700",
  ],
  [
    "DECLARATIONS - AUTO COVERAGES",
    "",
    "Combined Single Limit (Liability):           $1,000,000",
    "Uninsured/Underinsured Motorist:             $1,000,000",
    "Comprehensive Deductible:                    $1,000",
    "Collision Deductible:                        $1,000",
    "",
    "Covered Autos: Symbols 1, 8, 9",
  ],
  [
    "SCHEDULE OF FORMS AND ENDORSEMENTS",
    "",
    "CA 00 01 11 20   Business Auto Coverage Form",
    "IL 00 17 11 98   Common Policy Conditions",
  ],
]);

// --- Expected findings (what the eval harness scores against) --------------
const expectedDir = path.join(import.meta.dirname, "expected");
fs.mkdirSync(expectedDir, { recursive: true });

const expectations = {
  pair1: {
    criticals: [
      { category: "limits", field_match: "general aggregate", status: "mismatch" },
      { category: "forms", field_match: "cg 20 37", status: "not_found_in_policy" },
    ],
    moderates: [],
    minors: [{ category: "premium", field_match: "premium", status: "mismatch" }],
  },
  pair2: {
    criticals: [
      { category: "dates", field_match: "expiration", status: "mismatch" },
      { category: "deductibles", field_match: "deductible", status: "mismatch" },
    ],
    moderates: [{ category: "forms", field_match: "cp 10 30", status: "mismatch" }],
    minors: [],
  },
  pair3: {
    criticals: [
      { category: "named_insured", field_match: "named insured", status: "mismatch" },
    ],
    moderates: [{ category: "premium", field_match: "premium", status: "mismatch" }],
    minors: [],
  },
};

for (const [pair, expected] of Object.entries(expectations)) {

  // --- Input-quality trash specimens (the guardrail set) ---
  await makePdf("trash_email.pdf", [
    [
      "FROM: jbroker@agencymail.example",
      "TO: underwriting@carrier.example",
      "SUBJECT: RE: RE: FW: Acme renewal - attached docs",
      "",
      "Hi Sandra,",
      "",
      "Attached are the docs we discussed on the call. Let me know if the",
      "committee needs anything else before Friday. Also - golf Thursday?",
      "",
      "Thanks,",
      "Jim",
      "",
      "Reference: BR-STUB:trash-doc",
    ],
  ]);
  await makePdf("trash_blank.pdf", [["", "Reference: BR-STUB:trash-doc", ""]]);
  await makePdf("trash_memo.pdf", [
    [
      "INTEROFFICE MEMO",
      "",
      "All staff: the parking lot will be repaved Tuesday.",
      "Please use the north entrance.",
      "",
      "Reference: BR-STUB:trash-doc",
    ],
  ]);

  fs.writeFileSync(
    path.join(expectedDir, `${pair}.json`),
    JSON.stringify(expected, null, 2)
  );
  console.log(`wrote expected/${pair}.json`);
}
