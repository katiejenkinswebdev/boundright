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
  revalidatePath("/admin");
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
  revalidatePath("/admin");
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
  revalidatePath("/admin");
}
