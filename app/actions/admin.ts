"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { isSystemAdmin } from "@/lib/roles";
import { createAdminClient } from "@/lib/supabase/admin";

/** System admin only: flip smart intake for a client agency. */
export async function toggleSmartIntake(agencyId: string, enabled: boolean): Promise<void> {
  const { profile } = await requireProfile();
  if (!isSystemAdmin(profile)) throw new Error("System admin only.");
  const admin = createAdminClient();
  if (!admin) return;
  await admin.from("agencies").update({ smart_intake_enabled: enabled }).eq("id", agencyId);
  await admin.from("events").insert({
    agency_id: agencyId,
    user_id: profile.user_id,
    event_name: "smart_intake_toggled",
    metadata: { enabled },
  });
  revalidatePath("/ops");
}

/** System admin only: post a platform announcement banner with an active window. */
export async function createAnnouncement(formData: FormData): Promise<void> {
  const { profile } = await requireProfile();
  if (!isSystemAdmin(profile)) throw new Error("System admin only.");
  const admin = createAdminClient();
  if (!admin) return;

  const message = String(formData.get("message") ?? "").trim().slice(0, 300);
  const linkUrl = String(formData.get("link_url") ?? "").trim();
  const startsRaw = String(formData.get("starts_at") ?? "").trim();
  const endsRaw = String(formData.get("ends_at") ?? "").trim();
  if (!message || !endsRaw) return;
  const startsAt = startsRaw ? new Date(startsRaw) : new Date();
  const endsAt = new Date(endsRaw);
  if (Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) return;

  await admin.from("announcements").insert({
    message,
    link_url: linkUrl || null,
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
    created_by: profile.user_id,
  });
  revalidatePath("/ops");
}

/** System admin only: end an announcement now (expires it rather than deleting). */
export async function endAnnouncement(id: string): Promise<void> {
  const { profile } = await requireProfile();
  if (!isSystemAdmin(profile)) throw new Error("System admin only.");
  const admin = createAdminClient();
  if (!admin) return;
  await admin
    .from("announcements")
    .update({ ends_at: new Date().toISOString() })
    .eq("id", id)
    .gt("ends_at", new Date().toISOString());
  revalidatePath("/ops");
}

/** System admin only: the platform-wide letter guidance, one place for all clients. */
export async function saveGlobalLetterGuidance(formData: FormData): Promise<void> {
  const { profile } = await requireProfile();
  if (!isSystemAdmin(profile)) throw new Error("System admin only.");
  const admin = createAdminClient();
  if (!admin) return;
  const value = String(formData.get("guidance") ?? "").trim().slice(0, 4000);
  await admin.from("platform_config").upsert({
    key: "letter_guidance",
    value,
    updated_at: new Date().toISOString(),
  });
  revalidatePath("/ops");
}

/** System admin only: per-client letter guidance. */
export async function saveAgencyLetterGuidance(agencyId: string, formData: FormData): Promise<void> {
  const { profile } = await requireProfile();
  if (!isSystemAdmin(profile)) throw new Error("System admin only.");
  const admin = createAdminClient();
  if (!admin) return;
  const value = String(formData.get("guidance") ?? "").trim().slice(0, 4000);
  await admin
    .from("agencies")
    .update({ letter_instructions: value || null })
    .eq("id", agencyId);
  await admin.from("events").insert({
    agency_id: agencyId,
    user_id: profile.user_id,
    event_name: "letter_guidance_updated",
    metadata: { length: value.length },
  });
  revalidatePath("/ops");
}

/** System admin only: set a client's logo on their behalf (co-branding). */
export async function uploadAgencyLogoAdmin(
  agencyId: string,
  formData: FormData
): Promise<{ ok: boolean; message: string }> {
  const { profile } = await requireProfile();
  if (!isSystemAdmin(profile)) throw new Error("System admin only.");
  const admin = createAdminClient();
  if (!admin) return { ok: false, message: "Server not configured." };
  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: "Choose an image file." };
  if (!["image/png", "image/jpeg"].includes(file.type)) return { ok: false, message: "Use a PNG or JPEG." };
  if (file.size > 2 * 1024 * 1024) return { ok: false, message: "Keep the logo under 2 MB." };
  const ext = file.type === "image/png" ? "png" : "jpg";
  const path = `${agencyId}/logo.${ext}`;
  const { error } = await admin.storage
    .from("logos")
    .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: true });
  if (error) return { ok: false, message: `Upload failed: ${error.message}` };
  const { data: pub } = admin.storage.from("logos").getPublicUrl(path);
  await admin.from("agencies").update({ logo_url: pub.publicUrl }).eq("id", agencyId);
  await admin.from("events").insert({
    agency_id: agencyId,
    user_id: profile.user_id,
    event_name: "logo_set_by_operator",
    metadata: {},
  });
  revalidatePath("/ops");
  return { ok: true, message: "Logo updated." };
}

/** System admin only: override a client's monthly check allowance (null = plan default). */
export async function setAgencyAllowance(agencyId: string, formData: FormData): Promise<void> {
  const { profile } = await requireProfile();
  if (!isSystemAdmin(profile)) throw new Error("System admin only.");
  const admin = createAdminClient();
  if (!admin) return;
  const raw = String(formData.get("allowance") ?? "").trim();
  const value = raw === "" ? null : Math.max(1, Math.min(10_000, Number(raw) || 0)) || null;
  await admin.from("agencies").update({ checks_allowance: value }).eq("id", agencyId);
  await admin.from("events").insert({
    agency_id: agencyId,
    user_id: profile.user_id,
    event_name: "allowance_overridden",
    metadata: { allowance: value },
  });
  revalidatePath("/ops");
}

/** System admin only: edit a legal document (terms or privacy). */
export async function saveLegalDoc(formData: FormData): Promise<void> {
  const { profile } = await requireProfile();
  if (!isSystemAdmin(profile)) throw new Error("System admin only.");
  const admin = createAdminClient();
  if (!admin) return;
  const key = String(formData.get("doc") ?? "");
  if (!["legal_terms", "legal_privacy"].includes(key)) return;
  const value = String(formData.get("content") ?? "").slice(0, 100_000);
  await admin.from("platform_config").upsert({ key, value, updated_at: new Date().toISOString() });
  revalidatePath("/terms");
  revalidatePath("/privacy");
  revalidatePath("/ops");
}
