"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function dismissOnboarding(): Promise<void> {
  const { agency } = await requireProfile();
  const admin = createAdminClient();
  if (!admin) return;
  await admin
    .from("agencies")
    .update({ onboarding_dismissed_at: new Date().toISOString() })
    .eq("id", agency.id);
  revalidatePath("/dashboard");
}
