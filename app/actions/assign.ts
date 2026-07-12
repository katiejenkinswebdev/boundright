"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";

export type AssignResult = { ok: true } | { ok: false; message: string };

/** Routes a check to a teammate for review (any member may assign). */
export async function assignCheck(
  checkId: string,
  userId: string | null
): Promise<AssignResult> {
  const { supabase } = await requireProfile();
  const { data, error } = await supabase
    .from("checks")
    .update({ assigned_to: userId })
    .eq("id", checkId)
    .select("id")
    .maybeSingle();
  if (error || !data) return { ok: false, message: "Couldn't assign. Try again." };
  revalidatePath(`/checks/${checkId}`);
  revalidatePath("/checks");
  revalidatePath("/dashboard");
  return { ok: true };
}
