"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";

export type SettingsState = { status: "idle" | "ok" | "error"; message: string };

const ok = (message: string): SettingsState => ({ status: "ok", message });
const fail = (message: string): SettingsState => ({ status: "error", message });

export async function updateProfile(
  _prev: SettingsState,
  formData: FormData
): Promise<SettingsState> {
  const { supabase, profile, user } = await requireProfile();
  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!fullName) return fail("Enter your name.");
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName })
    .eq("id", profile.id);
  if (error) return fail("Couldn't save. Try again.");

  if (email && email !== (user.email ?? "").toLowerCase()) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail("Enter a valid email.");
    const { error: eErr } = await supabase.auth.updateUser({ email });
    if (eErr) return fail(`Couldn't change the email: ${eErr.message}`);
    revalidatePath("/settings");
    return ok(
      "Profile saved. Check both your old and new inboxes for confirmation links; the email changes once you confirm."
    );
  }
  revalidatePath("/settings");
  return ok("Profile saved.");
}

export async function updateAgency(
  _prev: SettingsState,
  formData: FormData
): Promise<SettingsState> {
  const { supabase, agency } = await requireProfile();
  const name = String(formData.get("agency_name") ?? "").trim();
  const minutes = Number(formData.get("manual_check_minutes"));
  const premium = Number(formData.get("avg_account_premium"));
  const rate = Number(formData.get("csr_hourly_rate"));
  const varPct = Number(formData.get("premium_variance_threshold"));
  const renewalPct = Number(formData.get("renewal_premium_threshold"));
  const reminderHours = Number(formData.get("reminder_hours"));
  if (!name) return fail("Enter your agency's name.");
  for (const v of [minutes, premium, rate, varPct, renewalPct, reminderHours]) {
    if (!Number.isFinite(v) || v <= 0) return fail("Every number must be above zero.");
  }
  if (varPct > 50 || renewalPct > 100) return fail("Premium thresholds look too high to be useful.");
  const { error } = await supabase
    .from("agencies")
    .update({
      name,
      manual_check_minutes: Math.round(minutes),
      avg_account_premium: premium,
      csr_hourly_rate: rate,
      premium_variance_threshold: varPct,
      renewal_premium_threshold: renewalPct,
      reminder_hours: Math.round(reminderHours),
    })
    .eq("id", agency.id);
  if (error) return fail("Couldn't save. Try again.");
  revalidatePath("/settings");
  return ok("Agency settings saved.");
}

export async function uploadLogo(
  _prev: SettingsState,
  formData: FormData
): Promise<SettingsState> {
  const { agency } = await requireProfile();
  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) return fail("Choose an image file.");
  if (!["image/png", "image/jpeg"].includes(file.type)) {
    return fail("Use a PNG or JPEG image.");
  }
  if (file.size > 2 * 1024 * 1024) return fail("Keep the logo under 2 MB.");

  const admin = createAdminClient();
  if (!admin) return fail("Server not configured.");
  const ext = file.type === "image/png" ? "png" : "jpg";
  const path = `${agency.id}/logo.${ext}`;
  const { error } = await admin.storage
    .from("logos")
    .upload(path, Buffer.from(await file.arrayBuffer()), {
      contentType: file.type,
      upsert: true,
    });
  if (error) return fail("Upload failed. Try again.");
  const { data: pub } = admin.storage.from("logos").getPublicUrl(path);
  // Same path every upload: version the URL or every cache keeps the old image.
  const url = `${pub.publicUrl}?v=${Date.now()}`;
  await admin.from("agencies").update({ logo_url: url }).eq("id", agency.id);
  revalidatePath("/", "layout");
  return ok("Logo uploaded.");
}

export async function changePassword(
  _prev: SettingsState,
  formData: FormData
): Promise<SettingsState> {
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) return fail("Use a password of at least 8 characters.");
  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return fail(error.message);
  return ok("Password updated.");
}

export async function updateIntegrations(
  _prev: SettingsState,
  formData: FormData
): Promise<SettingsState> {
  const { supabase, agency, profile } = await requireProfile();
  if (profile.role !== "admin") return fail("Only admins can change integrations.");
  const url = String(formData.get("notify_webhook_url") ?? "").trim();
  if (url && !/^https:\/\//.test(url)) {
    return fail("Webhook URL must start with https://");
  }
  const { error } = await supabase
    .from("agencies")
    .update({ notify_webhook_url: url || null })
    .eq("id", agency.id);
  if (error) return fail("Couldn't save. Try again.");
  revalidatePath("/settings");
  return ok(url ? "Webhook saved. New-check and reminder notices will post there." : "Webhook removed.");
}

export async function sendTestNotice(
  _prev: SettingsState,
  _formData: FormData
): Promise<SettingsState> {
  const { agency, profile } = await requireProfile();
  if (profile.role !== "admin" && profile.role !== "system_admin") {
    return fail("Only admins can send test notices.");
  }
  if (!agency.notify_webhook_url) return fail("Save a webhook URL first.");
  const { notifyAgency } = await import("@/lib/notify");
  await notifyAgency(agency.id, `BoundRight test notice for ${agency.name}. You're connected.`);
  return ok("Test notice sent. Check your channel.");
}

/** Danger zone: deletes the agency, all its data, and the account. */
export async function deleteAccount(
  _prev: SettingsState,
  formData: FormData
): Promise<SettingsState> {
  const { supabase, agency, user } = await requireProfile();
  const typed = String(formData.get("confirm_name") ?? "").trim();
  if (typed !== agency.name) {
    return fail("Type your agency's name exactly to confirm.");
  }
  const admin = createAdminClient();
  if (!admin) return fail("Server not configured.");

  // Everything cascades from agencies; then remove auth users.
  const { data: members } = await admin
    .from("profiles")
    .select("user_id")
    .eq("agency_id", agency.id);
  await admin.from("agencies").delete().eq("id", agency.id);
  for (const m of members ?? []) {
    if (m.user_id !== user.id) await admin.auth.admin.deleteUser(m.user_id);
  }
  await supabase.auth.signOut();
  await admin.auth.admin.deleteUser(user.id);
  redirect("/");
}
