"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { isSystemAdmin } from "@/lib/roles";
import { createAdminClient } from "@/lib/supabase/admin";
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

type UserSpec = { first: string; last: string; email: string; role: string; password: string };

function parseUserLines(raw: string): { users: UserSpec[]; errors: string[] } {
  const users: UserSpec[] = [];
  const errors: string[] = [];
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (const [i, line] of lines.entries()) {
    const parts = line.split(/[,\t]/).map((p) => p.trim());
    if (parts.length < 5) {
      errors.push(`Line ${i + 1}: expected First, Last, Email, Role, Password`);
      continue;
    }
    const [first, last, email, role, password] = parts;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push(`Line ${i + 1}: "${email}" isn't a valid email`);
      continue;
    }
    if (!["user", "manager", "admin"].includes(role.toLowerCase())) {
      errors.push(`Line ${i + 1}: role must be user, manager, or admin`);
      continue;
    }
    if (password.length < 8) {
      errors.push(`Line ${i + 1}: default password must be at least 8 characters`);
      continue;
    }
    users.push({ first, last, email: email.toLowerCase(), role: role.toLowerCase(), password });
  }
  return { users, errors };
}

/**
 * System admin only: the whole client setup in one submit — agency with
 * plan/allowance/smart intake, the client admin, and any number of
 * provisioned users (First, Last, Email, Role, Password per line). Every
 * provisioned account must change its password at first sign-in.
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
  const allowanceRaw = String(formData.get("allowance") ?? "").trim();
  const smartIntake = formData.get("smart_intake") === "on" || plan === "premium";
  const adminFirst = String(formData.get("admin_first") ?? "").trim();
  const adminLast = String(formData.get("admin_last") ?? "").trim();
  const adminEmail = String(formData.get("admin_email") ?? "").trim().toLowerCase();
  const adminPassword = String(formData.get("admin_password") ?? "");
  const usersRaw = String(formData.get("users") ?? "");

  if (!name) return { status: "error", message: "Give the agency a name." };
  if (!(plan in PLANS)) return { status: "error", message: "Pick a plan." };
  if (!adminFirst || !adminLast) {
    return { status: "error", message: "Enter the client admin's first and last name." };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) {
    return { status: "error", message: "Enter the client admin's email." };
  }
  if (adminPassword.length < 8) {
    return { status: "error", message: "The admin's default password needs at least 8 characters." };
  }
  const { users, errors } = parseUserLines(usersRaw);
  if (errors.length > 0) {
    return { status: "error", message: `Fix the user list first: ${errors.join(" · ")}` };
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
      smart_intake_enabled: smartIntake,
      trial_ends_at:
        plan === "trial" ? new Date(Date.now() + 14 * 86_400_000).toISOString() : null,
    })
    .select("id")
    .single();
  if (error || !agency) {
    return { status: "error", message: `Couldn't create the agency: ${error?.message}` };
  }

  // Provision the admin first, then the rest. Skips (existing emails, etc.)
  // are reported, never silently dropped.
  const roster: UserSpec[] = [
    { first: adminFirst, last: adminLast, email: adminEmail, role: "admin", password: adminPassword },
    ...users,
  ];
  let created = 0;
  const skipped: string[] = [];
  for (const u of roster) {
    const { data: authUser, error: uErr } = await admin.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
    });
    if (uErr || !authUser) {
      skipped.push(`${u.email} (${uErr?.message ?? "create failed"})`);
      continue;
    }
    const { error: pErr } = await admin.from("profiles").insert({
      user_id: authUser.user.id,
      agency_id: agency.id,
      full_name: `${u.first} ${u.last}`,
      role: u.role,
      must_change_password: true,
    });
    if (pErr) {
      skipped.push(`${u.email} (profile: ${pErr.message})`);
      await admin.auth.admin.deleteUser(authUser.user.id);
      continue;
    }
    created++;
  }

  await admin.from("events").insert({
    agency_id: agency.id,
    user_id: profile.user_id,
    event_name: "client_created_by_operator",
    metadata: { plan, allowance, smart_intake: smartIntake, users_created: created },
  });
  revalidatePath("/ops");
  const skippedNote = skipped.length ? ` Skipped: ${skipped.join(" · ")}` : "";
  return {
    status: skipped.length && created === 0 ? "error" : "ok",
    message: `${name} is set up on ${PLANS[plan as keyof typeof PLANS].name} with ${created} account${created === 1 ? "" : "s"}. Everyone signs in with their default password and must change it immediately.${skippedNote}`,
  };
}

/** System admin only: update any of a client's settings from the detail page. */
export async function updateAgencySettings(
  agencyId: string,
  _prev: NewClientState,
  formData: FormData
): Promise<NewClientState> {
  const { profile } = await requireProfile();
  if (!isSystemAdmin(profile)) return { status: "error", message: "System admin only." };
  const admin = createAdminClient();
  if (!admin) return { status: "error", message: "Server not configured." };

  const plan = String(formData.get("plan") ?? "");
  if (!(plan in PLANS)) return { status: "error", message: "Pick a plan." };
  const num = (key: string, lo: number, hi: number, fallback: number) => {
    const v = Number(String(formData.get(key) ?? "").trim());
    return Number.isFinite(v) && v >= lo && v <= hi ? v : fallback;
  };
  const allowanceRaw = String(formData.get("allowance") ?? "").trim();
  const values = {
    name: String(formData.get("name") ?? "").trim().slice(0, 120) || undefined,
    plan,
    checks_allowance:
      allowanceRaw === "" ? null : Math.max(1, Math.min(10_000, Number(allowanceRaw) || 0)) || null,
    smart_intake_enabled: formData.get("smart_intake") === "on" || plan === "premium",
    notify_webhook_url: String(formData.get("webhook") ?? "").trim() || null,
    manual_check_minutes: num("manual_check_minutes", 5, 480, 45),
    avg_account_premium: num("avg_account_premium", 100, 10_000_000, 25_000),
    csr_hourly_rate: num("csr_hourly_rate", 5, 500, 35),
    premium_variance_threshold: num("premium_variance_threshold", 0, 100, 5),
    renewal_premium_threshold: num("renewal_premium_threshold", 0, 100, 10),
    reminder_hours: num("reminder_hours", 1, 720, 48),
  };
  const { error } = await admin.from("agencies").update(values).eq("id", agencyId);
  if (error) return { status: "error", message: `Couldn't save: ${error.message}` };
  await admin.from("events").insert({
    agency_id: agencyId,
    user_id: profile.user_id,
    event_name: "client_settings_updated_by_operator",
    metadata: { plan },
  });
  revalidatePath("/ops");
  revalidatePath(`/ops/${agencyId}`);
  return { status: "ok", message: "Client settings saved." };
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
