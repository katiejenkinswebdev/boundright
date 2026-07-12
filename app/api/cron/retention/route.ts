import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailHtml, ownerEmail, sendEmail } from "@/lib/email";
import { isAuthorizedCron } from "../route-helpers";

const DAY = 86_400_000;

/**
 * Post-cancellation retention: warning emails at 76 and 88 days after the
 * subscription ended, deletion at 90 (as promised in the ToS/privacy copy).
 */
export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "not configured" }, { status: 503 });

  const { data: canceled } = await admin
    .from("events")
    .select("agency_id, created_at")
    .eq("event_name", "subscription_canceled");
  const canceledAt = new Map<string, number>();
  for (const e of canceled ?? []) {
    if (!e.agency_id) continue;
    const t = new Date(e.created_at).getTime();
    canceledAt.set(e.agency_id, Math.max(canceledAt.get(e.agency_id) ?? 0, t));
  }

  let warned = 0;
  let deleted = 0;
  for (const [agencyId, t] of canceledAt) {
    const { data: agency } = await admin
      .from("agencies")
      .select("id, name, billing_status")
      .eq("id", agencyId)
      .maybeSingle();
    if (!agency || agency.billing_status !== "canceled") continue;
    const days = Math.floor((Date.now() - t) / DAY);

    if (days >= 90) {
      await admin.from("agencies").delete().eq("id", agencyId);
      deleted++;
      continue;
    }
    for (const mark of [76, 88] as const) {
      if (days < mark) continue;
      const { count } = await admin
        .from("events")
        .select("id", { count: "exact", head: true })
        .eq("agency_id", agencyId)
        .eq("event_name", `retention_warning_${mark}`);
      if ((count ?? 0) > 0) continue;
      const email = await ownerEmail(agencyId);
      if (email) {
        await sendEmail(
          email,
          `Your BoundRight data is deleted in ${90 - days} days`,
          emailHtml({
            heading: `Your data is deleted in ${90 - days} days`,
            bodyHtml: `<p style="margin:0;">Your subscription ended ${days} days ago. Per our retention policy, all agency data is permanently deleted 90 days after cancellation. Resubscribe to keep it, or export any reports you need now.</p>`,
            cta: { label: "Sign in", url: `${process.env.APP_URL}/login` },
          })
        );
      }
      await admin.from("events").insert({
        agency_id: agencyId,
        event_name: `retention_warning_${mark}`,
        metadata: { days },
      });
      warned++;
    }
  }
  return NextResponse.json({ warned, deleted });
}
