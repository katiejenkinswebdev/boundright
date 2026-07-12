/** One place for what each severity means; every tooltip reads from here. */
export const SEVERITY_DEF = {
  critical:
    "Wrong named insured, limits, deductibles, dates, or a missing form or endorsement.",
  moderate:
    "Premium variance over your agency's threshold, or form edition-date changes.",
  minor: "Formatting differences and small premium variance.",
} as const;

export type Severity = keyof typeof SEVERITY_DEF;
