import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Posts to the agency's Slack or Teams incoming webhook, if configured.
 * Both accept a simple {text} payload. Never blocks the caller.
 */
export async function notifyAgency(agencyId: string, text: string): Promise<void> {
  const admin = createAdminClient();
  if (!admin) return;
  const { data: agency } = await admin
    .from("agencies")
    .select("notify_webhook_url")
    .eq("id", agencyId)
    .maybeSingle();
  const url = agency?.notify_webhook_url;
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
  } catch (err) {
    console.error("Webhook notify failed:", err instanceof Error ? err.message : err);
  }
}
