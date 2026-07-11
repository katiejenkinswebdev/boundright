import { createAdminClient } from "@/lib/supabase/admin";

const DISCLAIMER =
  "BoundRight is a review assistant. It does not provide insurance advice, and final determination of coverage accuracy is the responsibility of the licensed agent.";

/**
 * Type-led branded email shell (brand guidelines: no imagery, Ink on Paper,
 * wordmark in text, signature block). All outgoing mail goes through this.
 */
export function emailHtml(opts: {
  heading: string;
  bodyHtml: string;
  cta?: { label: string; url: string };
  includeDisclaimer?: boolean;
}): string {
  const { heading, bodyHtml, cta, includeDisclaimer = true } = opts;
  return `<!doctype html>
<html>
<body style="margin:0;padding:0;background:#FAFAF7;">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px;font-family:'IBM Plex Sans',Helvetica,Arial,sans-serif;color:#1B2A41;">
    <p style="margin:0 0 24px;font-size:18px;">
      <strong style="font-weight:600;">Bound</strong><span style="font-weight:400;">Right</span>
    </p>
    <div style="background:#FFFFFF;border:1px solid #D8D9D4;border-radius:8px;padding:28px;">
      <h1 style="margin:0 0 12px;font-size:20px;font-weight:600;line-height:1.3;">${heading}</h1>
      <div style="font-size:16px;line-height:1.6;">${bodyHtml}</div>
      ${
        cta
          ? `<p style="margin:24px 0 0;"><a href="${cta.url}" style="display:inline-block;background:#1B2A41;color:#FAFAF7;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:4px;">${cta.label}</a></p>`
          : ""
      }
    </div>
    <p style="margin:20px 0 4px;font-size:13px;line-height:1.5;color:#6b7280;">
      Every account. Bound right.
    </p>
    ${
      includeDisclaimer
        ? `<p style="margin:4px 0 0;font-size:12px;line-height:1.5;color:#9ca3af;">${DISCLAIMER}</p>`
        : ""
    }
  </div>
</body>
</html>`;
}

/** Sends via Resend; a no-op without RESEND_API_KEY. Never blocks the caller. */
export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  attachments?: { filename: string; content: string }[]
): Promise<void> {
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
        ...(attachments ? { attachments } : {}),
      }),
    });
  } catch (err) {
    console.error("Email send failed:", err instanceof Error ? err.message : err);
  }
}

/** Resolves the agency owner's email address, or null. */
export async function ownerEmail(agencyId: string): Promise<string | null> {
  const admin = createAdminClient();
  if (!admin) return null;
  const { data: owner } = await admin
    .from("profiles")
    .select("user_id")
    .eq("agency_id", agencyId)
    .eq("role", "owner")
    .limit(1)
    .maybeSingle();
  if (!owner) return null;
  const { data: userData } = await admin.auth.admin.getUserById(owner.user_id);
  return userData?.user?.email ?? null;
}

export async function sendCheckReadyEmail(
  agencyId: string,
  checkId: string,
  label: string
): Promise<void> {
  const email = await ownerEmail(agencyId);
  if (!email) return;

  const url = `${process.env.APP_URL ?? "http://localhost:3000"}/checks/${checkId}`;
  await sendEmail(
    email,
    `Your check for ${label} is ready`,
    emailHtml({
      heading: `Your check for ${label} is ready`,
      bodyHtml: `<p style="margin:0;">BoundRight finished comparing the documents. Review the findings, confirm or dismiss each one, and export the report for the file.</p>`,
      cta: { label: "Review the findings", url },
    })
  );
}
