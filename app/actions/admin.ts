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
