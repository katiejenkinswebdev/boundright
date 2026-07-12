/**
 * The pricing strategy, in one place. To change pricing: edit this file,
 * create the matching price in Stripe, and point the STRIPE_PRICE_ID_*
 * env var at it. Every surface reads from here — landing page cards,
 * Settings → Billing, and the usage caps — so nothing else needs touching.
 */
export const PLANS = {
  trial: {
    name: "Trial",
    monthly: 0,
    checksPerMonth: 10,
    trialDays: 14,
    blurb: "No credit card. Every feature, including exported reports.",
  },
  founding: {
    name: "Founding",
    monthly: 249,
    checksPerMonth: 150,
    blurb: "For the first agencies on board. The price stays locked in.",
  },
  standard: {
    name: "Standard",
    monthly: 349,
    checksPerMonth: 150,
    blurb:
      "Cancel anytime in one click. When a limit is reached, checks pause. We never bill overages.",
  },
} as const;

export type PlanKey = keyof typeof PLANS;

/** Monthly check allowance for an agency's plan (unknown plans get standard's). */
export function planCap(plan: string): number {
  return (PLANS as Record<string, { checksPerMonth: number }>)[plan]?.checksPerMonth
    ?? PLANS.standard.checksPerMonth;
}
