"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";

export type DeleteResult = { ok: true } | { ok: false; message: string };

/** Deletes a check; findings cascade, dashboard stats adjust automatically. */
export async function deleteCheck(checkId: string): Promise<DeleteResult> {
  const { supabase } = await requireProfile();
  const { data, error } = await supabase
    .from("checks")
    .delete()
    .eq("id", checkId)
    .select("id");
  if (error || !data || data.length === 0) {
    return { ok: false, message: "Couldn't delete that check. Try again." };
  }
  revalidatePath("/checks");
  revalidatePath("/dashboard");
  return { ok: true };
}

/** Archive (or restore) a check: list hygiene, never deletion. Metrics keep counting it. */
export async function setCheckArchived(
  checkId: string,
  archived: boolean
): Promise<DeleteResult> {
  const { supabase } = await requireProfile();
  const { data, error } = await supabase
    .from("checks")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", checkId)
    .select("id");
  if (error || !data || data.length === 0) {
    return { ok: false, message: "Couldn't update that check. Try again." };
  }
  revalidatePath("/checks");
  revalidatePath("/dashboard");
  return { ok: true };
}
