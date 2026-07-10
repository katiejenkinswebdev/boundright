"use server";

import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";

const NOT_CONFIGURED =
  "Billing isn't configured in this environment yet. Email help@boundright.app.";

export type BillingState = { status: "idle" | "error"; message: string };

function appUrl(path: string): string {
  return `${process.env.APP_URL ?? "http://localhost:3000"}${path}`;
}

/** Starts Stripe Checkout for the chosen plan. */
export async function startCheckout(
  _prev: BillingState,
  formData: FormData
): Promise<BillingState> {
  const { agency, user } = await requireProfile();
  const stripe = getStripe();
  if (!stripe) return { status: "error", message: NOT_CONFIGURED };

  const plan = String(formData.get("plan"));
  const priceId =
    plan === "founding"
      ? process.env.STRIPE_PRICE_ID_FOUNDING
      : process.env.STRIPE_PRICE_ID_STANDARD;
  if (!priceId) return { status: "error", message: NOT_CONFIGURED };

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    customer: agency.stripe_customer_id ?? undefined,
    customer_email: agency.stripe_customer_id ? undefined : (user.email ?? undefined),
    client_reference_id: agency.id,
    metadata: { agency_id: agency.id, plan },
    subscription_data: { metadata: { agency_id: agency.id, plan } },
    success_url: appUrl("/settings?billing=success"),
    cancel_url: appUrl("/settings"),
  });

  redirect(session.url!);
}

/** Opens the Stripe Customer Portal: card, invoices, one-click cancel. */
export async function openBillingPortal(
  _prev: BillingState,
  _formData: FormData
): Promise<BillingState> {
  const { agency } = await requireProfile();
  const stripe = getStripe();
  if (!stripe) return { status: "error", message: NOT_CONFIGURED };
  if (!agency.stripe_customer_id) {
    return { status: "error", message: "No subscription yet. Pick a plan first." };
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: agency.stripe_customer_id,
    return_url: appUrl("/settings"),
  });
  redirect(session.url);
}

/** First of next month, UTC. */
export async function nextPeriodReset(): Promise<string> {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString();
}

export async function recordSubscription(
  agencyId: string,
  customerId: string,
  plan: "founding" | "standard"
): Promise<void> {
  const admin = createAdminClient();
  if (!admin) return;
  await admin
    .from("agencies")
    .update({
      plan,
      stripe_customer_id: customerId,
      billing_status: "ok",
      billing_grace_until: null,
      checks_this_period: 0,
      period_resets_at: await nextPeriodReset(),
      trial_ends_at: null,
    })
    .eq("id", agencyId);
  await admin.from("events").insert({
    agency_id: agencyId,
    event_name: "subscription_started",
    metadata: { plan },
  });
}
