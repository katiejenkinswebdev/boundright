"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { isSystemAdmin } from "@/lib/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { randomBytes } from "node:crypto";
import { emailHtml, sendEmail } from "@/lib/email";
import { PLANS } from "@/lib/pricing";

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
  // Same path every upload: version the URL or every cache keeps the old image.
  await admin.from("agencies").update({ logo_url: `${pub.publicUrl}?v=${Date.now()}` }).eq("id", agencyId);
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

export type NewClientState = { status: "idle" | "ok" | "error"; message: string };

/**
 * System admin only: sets up a new client in one step — agency with plan,
 * allowance, and smart intake configured, plus an admin invite emailed to
 * the client (link also returned for copy/paste).
 */
export async function createClientAgency(
  _prev: NewClientState,
  formData: FormData
): Promise<NewClientState> {
  const { profile } = await requireProfile();
  if (!isSystemAdmin(profile)) return { status: "error", message: "System admin only." };
  const admin = createAdminClient();
  if (!admin) return { status: "error", message: "Server not configured." };

  const name = String(formData.get("name") ?? "").trim().slice(0, 120);
  const plan = String(formData.get("plan") ?? "trial");
  const adminEmail = String(formData.get("admin_email") ?? "").trim().toLowerCase();
  const allowanceRaw = String(formData.get("allowance") ?? "").trim();
  const smartIntake = formData.get("smart_intake") === "on";
  if (!name) return { status: "error", message: "Give the agency a name." };
  if (!(plan in PLANS)) return { status: "error", message: "Pick a plan." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) {
    return { status: "error", message: "Enter the client admin's email." };
  }

  const allowance =
    allowanceRaw === "" ? null : Math.max(1, Math.min(10_000, Number(allowanceRaw) || 0)) || null;
  const { data: agency, error } = await admin
    .from("agencies")
    .insert({
      name,
      plan,
      billing_status: "ok",
      checks_allowance: allowance,
      smart_intake_enabled: smartIntake || plan === "premium",
      trial_ends_at:
        plan === "trial" ? new Date(Date.now() + 14 * 86_400_000).toISOString() : null,
    })
    .select("id")
    .single();
  if (error || !agency) {
    return { status: "error", message: `Couldn't create the agency: ${error?.message}` };
  }

  const token = randomBytes(18).toString("hex");
  const { error: invErr } = await admin.from("invites").insert({
    agency_id: agency.id,
    email: adminEmail,
    role: "admin",
    token,
    invited_by: profile.user_id,
  });
  if (invErr) return { status: "error", message: "Agency created, but the invite failed." };

  const url = `${process.env.APP_URL ?? "http://localhost:3000"}/join/${token}`;
  await sendEmail(
    adminEmail,
    `Your ${name} workspace on BoundRight is ready`,
    emailHtml({
      heading: `Welcome to BoundRight`,
      bodyHtml: `<p style="margin:0;">Your agency workspace "${name}" is set up on the ${PLANS[plan as keyof typeof PLANS].name} plan. The link below signs you in as the agency admin.</p>`,
      cta: { label: "Open your workspace", url },
    })
  );
  await admin.from("events").insert({
    agency_id: agency.id,
    user_id: profile.user_id,
    event_name: "client_created_by_operator",
    metadata: { plan, allowance, smart_intake: smartIntake },
  });
  revalidatePath("/ops");
  return {
    status: "ok",
    message: `${name} is set up on ${PLANS[plan as keyof typeof PLANS].name}. Invite emailed to ${adminEmail} (link: ${url})`,
  };
}

/** System admin only: set a client's Slack/Teams webhook on their behalf. */
export async function setAgencyWebhook(agencyId: string, formData: FormData): Promise<void> {
  const { profile } = await requireProfile();
  if (!isSystemAdmin(profile)) throw new Error("System admin only.");
  const admin = createAdminClient();
  if (!admin) return;
  const raw = String(formData.get("webhook") ?? "").trim();
  if (raw && !/^https:\/\//.test(raw)) return;
  await admin.from("agencies").update({ notify_webhook_url: raw || null }).eq("id", agencyId);
  await admin.from("events").insert({
    agency_id: agencyId,
    user_id: profile.user_id,
    event_name: "webhook_set_by_operator",
    metadata: { set: !!raw },
  });
  revalidatePath("/ops");
}

/** System admin only: set a client's plan directly (managed billing). */
export async function setAgencyPlan(agencyId: string, formData: FormData): Promise<void> {
  const { profile } = await requireProfile();
  if (!isSystemAdmin(profile)) throw new Error("System admin only.");
  const admin = createAdminClient();
  if (!admin) return;
  const plan = String(formData.get("plan") ?? "");
  if (!(plan in PLANS)) return;
  await admin
    .from("agencies")
    .update({
      plan,
      smart_intake_enabled: plan === "premium" ? true : undefined,
      trial_ends_at: plan === "trial" ? new Date(Date.now() + 14 * 86_400_000).toISOString() : null,
    })
    .eq("id", agencyId);
  await admin.from("events").insert({
    agency_id: agencyId,
    user_id: profile.user_id,
    event_name: "plan_set_by_operator",
    metadata: { plan },
  });
  revalidatePath("/ops");
}
