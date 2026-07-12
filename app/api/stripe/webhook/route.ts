import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordSubscription } from "@/app/actions/billing";

const GRACE_DAYS = 7;

export async function POST(request: Request) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) {
    return NextResponse.json({ error: "not configured" }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "missing signature" }, { status: 400 });

  let event;
  try {
    event = stripe.webhooks.constructEvent(await request.text(), signature, secret);
  } catch {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "db not configured" }, { status: 503 });

  const agencyByCustomer = async (customerId: string) => {
    const { data } = await admin
      .from("agencies")
      .select("id")
      .eq("stripe_customer_id", customerId)
      .maybeSingle();
    return data?.id ?? null;
  };

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const agencyId = session.metadata?.agency_id ?? session.client_reference_id;
      const plan = ["founding", "premium"].includes(session.metadata?.plan ?? "")
        ? (session.metadata!.plan as "founding" | "premium")
        : "standard";
      if (agencyId && typeof session.customer === "string") {
        await recordSubscription(agencyId, session.customer, plan);
      }
      break;
    }
    case "invoice.payment_failed": {
      const invoice = event.data.object;
      const customerId = typeof invoice.customer === "string" ? invoice.customer : null;
      const agencyId = customerId && (await agencyByCustomer(customerId));
      if (agencyId) {
        await admin
          .from("agencies")
          .update({
            billing_status: "past_due",
            billing_grace_until: new Date(
              Date.now() + GRACE_DAYS * 86_400_000
            ).toISOString(),
          })
          .eq("id", agencyId);
        await admin.from("events").insert({
          agency_id: agencyId,
          event_name: "payment_failed",
          metadata: {},
        });
      }
      break;
    }
    case "invoice.paid": {
      const invoice = event.data.object;
      const customerId = typeof invoice.customer === "string" ? invoice.customer : null;
      const agencyId = customerId && (await agencyByCustomer(customerId));
      if (agencyId) {
        await admin
          .from("agencies")
          .update({ billing_status: "ok", billing_grace_until: null })
          .eq("id", agencyId);
      }
      break;
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object;
      const customerId = typeof sub.customer === "string" ? sub.customer : null;
      const agencyId = customerId && (await agencyByCustomer(customerId));
      if (agencyId) {
        // Read-only mode: data + dashboard preserved, new checks paused.
        // Data retained 90 days, then deletion with two warning emails (ops job).
        await admin
          .from("agencies")
          .update({ billing_status: "canceled" })
          .eq("id", agencyId);
        await admin.from("events").insert({
          agency_id: agencyId,
          event_name: "subscription_canceled",
          metadata: {},
        });
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
