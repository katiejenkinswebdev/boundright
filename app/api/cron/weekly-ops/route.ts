import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import { isAuthorizedCron } from "../route-helpers";

/** Weekly ops digest to the operator: signups, checks, failures, AI spend, MRR. */
export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const admin = createAdminClient();
  const adminEmail = (process.env.ADMIN_EMAILS ?? "").split(",")[0]?.trim();
  if (!admin || !adminEmail) {
    return NextResponse.json({ error: "not configured" }, { status: 503 });
  }

  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const [{ count: signups }, { data: checks }, { count: failures }] =
    await Promise.all([
      admin
        .from("agencies")
        .select("id", { count: "exact", head: true })
        .gte("created_at", weekAgo),
      admin
        .from("checks")
        .select("cost_cents")
        .gte("created_at", weekAgo),
      admin
        .from("checks")
        .select("id", { count: "exact", head: true })
        .eq("status", "failed")
        .gte("created_at", weekAgo),
    ]);

  const spendCents = (checks ?? []).reduce((s, c) => s + (c.cost_cents ?? 0), 0);

  let mrr = "n/a (Stripe not configured)";
  const stripe = getStripe();
  if (stripe) {
    try {
      let totalCents = 0;
      for await (const sub of stripe.subscriptions.list({ status: "active", limit: 100 })) {
        for (const item of sub.items.data) {
          totalCents += (item.price.unit_amount ?? 0) * (item.quantity ?? 1);
        }
      }
      mrr = `$${(totalCents / 100).toFixed(0)}`;
    } catch {
      mrr = "error fetching";
    }
  }

  const summary = {
    signups: signups ?? 0,
    checksRun: (checks ?? []).length,
    failures: failures ?? 0,
    aiSpend: `$${(spendCents / 100).toFixed(2)}`,
    mrr,
  };

  if (process.env.RESEND_API_KEY) {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "BoundRight Ops <notifications@boundright.app>",
        to: [adminEmail],
        subject: `BoundRight week: ${summary.signups} signups, ${summary.checksRun} checks, MRR ${summary.mrr}`,
        html: `<ul>
          <li>New signups: ${summary.signups}</li>
          <li>Checks run: ${summary.checksRun}</li>
          <li>Failures: ${summary.failures}</li>
          <li>AI spend: ${summary.aiSpend}</li>
          <li>MRR: ${summary.mrr}</li>
        </ul><p><a href="${process.env.APP_URL}/admin">Open the admin view</a></p>`,
      }),
    });
  }

  return NextResponse.json(summary);
}
