import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailHtml, ownerEmail, sendEmail } from "@/lib/email";
import { notifyAgency } from "@/lib/notify";
import { isAuthorizedCron } from "../route-helpers";

/** Daily: nudge agencies about checks sitting unreviewed for 48+ hours. */
export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "not configured" }, { status: 503 });

  const { data: staleAll } = await admin
    .from("checks")
    .select("id, agency_id, label, created_at, agencies(reminder_hours)")
    .eq("status", "ready_for_review");
  const stale = (staleAll ?? []).filter((c) => {
    const hours = Number(
      (c.agencies as unknown as { reminder_hours: number } | null)?.reminder_hours ?? 48
    );
    return Date.now() - new Date(c.created_at).getTime() > hours * 3_600_000;
  });

  const byAgency = new Map<string, { id: string; label: string }[]>();
  for (const c of stale) {
    const list = byAgency.get(c.agency_id) ?? [];
    list.push({ id: c.id, label: c.label });
    byAgency.set(c.agency_id, list);
  }

  let reminded = 0;
  for (const [agencyId, checks] of byAgency) {
    // At most one reminder per agency per day (events guard).
    const dayAgo = new Date(Date.now() - 24 * 3_600_000).toISOString();
    const { count } = await admin
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("agency_id", agencyId)
      .eq("event_name", "review_reminder_sent")
      .gte("created_at", dayAgo);
    if ((count ?? 0) > 0) continue;

    const names = checks.map((c) => c.label).slice(0, 5).join(", ");
    const text = `BoundRight: ${checks.length} check${checks.length === 1 ? "" : "s"} awaiting review (${names}). Findings only count once a licensed agent confirms them.`;
    await notifyAgency(agencyId, text);
    const email = await ownerEmail(agencyId);
    if (email) {
      await sendEmail(
        email,
        `${checks.length} check${checks.length === 1 ? "" : "s"} awaiting review`,
        emailHtml({
          heading: "Checks are waiting on a reviewer",
          bodyHtml: `<p style="margin:0;">${text}</p>`,
          cta: { label: "Open BoundRight", url: `${process.env.APP_URL}/checks` },
        })
      );
    }
    await admin.from("events").insert({
      agency_id: agencyId,
      event_name: "review_reminder_sent",
      metadata: { check_ids: checks.map((c) => c.id) },
    });
    reminded++;
  }

  return NextResponse.json({ agenciesReminded: reminded, staleChecks: stale.length });
}
