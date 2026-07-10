"use server";

import { createAdminClient } from "@/lib/supabase/admin";

export type EmailCaptureState = {
  status: "idle" | "ok" | "error";
  message: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function captureEmail(
  _prev: EmailCaptureState,
  formData: FormData
): Promise<EmailCaptureState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();

  if (!EMAIL_RE.test(email)) {
    return {
      status: "error",
      message: "That doesn't look like an email address. Check it and try again.",
    };
  }

  const supabase = createAdminClient();
  if (!supabase) {
    // Skeleton phase: no database yet. Don't lose the lead silently —
    // tell the visitor to reach out directly.
    return {
      status: "error",
      message:
        "Signups aren't open quite yet. Email us at hello@boundright.app and we'll add you.",
    };
  }

  const { error } = await supabase
    .from("email_signups")
    .insert({ email, source: "landing" });

  // Duplicate email = already on the list; treat as success.
  if (error && error.code !== "23505") {
    return {
      status: "error",
      message: "Something went wrong on our end. Try again in a minute.",
    };
  }

  return {
    status: "ok",
    message: "You're on the list. We'll be in touch before launch.",
  };
}
