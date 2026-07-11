"use server";

import { requireProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export type FeedbackState = { status: "idle" | "ok" | "error"; message: string };

export async function sendFeedback(
  _prev: FeedbackState,
  formData: FormData
): Promise<FeedbackState> {
  const { profile, agency } = await requireProfile();
  const category = String(formData.get("category") ?? "general");
  const message = String(formData.get("message") ?? "").trim();
  const page = String(formData.get("page") ?? "").slice(0, 200);
  if (!message) return { status: "error", message: "Tell us what's on your mind first." };
  if (!["general", "bug", "idea", "accuracy"].includes(category)) {
    return { status: "error", message: "Pick a category." };
  }
  const admin = createAdminClient();
  if (!admin) return { status: "error", message: "Server not configured." };
  const { error } = await admin.from("feedback").insert({
    agency_id: agency.id,
    user_id: profile.user_id,
    category,
    message: message.slice(0, 4000),
    page: page || null,
  });
  if (error) return { status: "error", message: "Couldn't send that. Try again." };
  await admin.from("events").insert({
    agency_id: agency.id,
    user_id: profile.user_id,
    event_name: "feedback_submitted",
    metadata: { category },
  });
  return { status: "ok", message: "Thank you. A human reads every one of these." };
}
