import Stripe from "stripe";

/** Lazy Stripe client; null when keys aren't configured (local dev). */
export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key);
}
