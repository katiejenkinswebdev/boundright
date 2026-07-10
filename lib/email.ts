import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Transactional email via Resend. Degrades to a no-op when RESEND_API_KEY
 * isn't configured (local dev) — email must never block the pipeline.
 */
async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "BoundRight <notifications@boundright.app>",
        to: [to],
        subject,
        html,
      }),
    });
  } catch (err) {
    console.error("Email send failed:", err instanceof Error ? err.message : err);
  }
}

export async function sendCheckReadyEmail(
  agencyId: string,
  checkId: string,
  label: string
): Promise<void> {
  const admin = createAdminClient();
  if (!admin) return;
  // v1: notify the agency owner.
  const { data: owner } = await admin
    .from("profiles")
    .select("user_id")
    .eq("agency_id", agencyId)
    .eq("role", "owner")
    .limit(1)
    .maybeSingle();
  if (!owner) return;
  const { data: userData } = await admin.auth.admin.getUserById(owner.user_id);
  const email = userData?.user?.email;
  if (!email) return;

  const url = `${process.env.APP_URL ?? "http://localhost:3000"}/checks/${checkId}`;
  await sendEmail(
    email,
    `Your check for ${label} is ready`,
    `<p>BoundRight finished comparing the documents for <strong>${label}</strong>.</p>
     <p><a href="${url}">Review the findings</a></p>
     <p style="color:#666;font-size:13px">BoundRight is a review assistant. It does not provide insurance advice, and final determination of coverage accuracy is the responsibility of the licensed agent.</p>`
  );
}
