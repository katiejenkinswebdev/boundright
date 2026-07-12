"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";

export type MfaState = { status: "idle" | "ok" | "error"; message: string };
const ok = (m: string): MfaState => ({ status: "ok", message: m });
const fail = (m: string): MfaState => ({ status: "error", message: m });

export type EnrollResult =
  | { ok: true; factorId: string; qrCode: string; secret: string }
  | { ok: false; message: string };

/** Starts TOTP enrollment: returns the QR code to scan and the manual secret. */
export async function enrollMfa(): Promise<EnrollResult> {
  const supabase = await createServerSupabase();
  // Clear any abandoned half-enrollments so re-tries don't pile up factors.
  const { data: factors } = await supabase.auth.mfa.listFactors();
  for (const f of factors?.all ?? []) {
    if (f.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: f.id });
  }
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: "Authenticator app",
  });
  if (error || !data) return { ok: false, message: error?.message ?? "Couldn't start enrollment." };
  return {
    ok: true,
    factorId: data.id,
    qrCode: data.totp.qr_code,
    secret: data.totp.secret,
  };
}

/** Confirms enrollment with the app's 6-digit code. MFA is on after this. */
export async function verifyMfaEnrollment(
  _prev: MfaState,
  formData: FormData
): Promise<MfaState> {
  const factorId = String(formData.get("factor_id") ?? "");
  const code = String(formData.get("code") ?? "").trim();
  if (!/^\d{6}$/.test(code)) return fail("Enter the 6-digit code from your app.");
  const supabase = await createServerSupabase();
  const { data: challenge, error: cErr } = await supabase.auth.mfa.challenge({ factorId });
  if (cErr || !challenge) return fail("Couldn't verify. Start over.");
  const { error } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    code,
  });
  if (error) return fail("That code didn't match. Check your app and try again.");
  revalidatePath("/settings");
  return ok("Two-factor authentication is on. You'll enter a code at every sign-in.");
}

/** Turns MFA off (requires the current session to have passed MFA). */
export async function unenrollMfa(_prev: MfaState, formData: FormData): Promise<MfaState> {
  const factorId = String(formData.get("factor_id") ?? "");
  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) return fail(`Couldn't turn off two-factor: ${error.message}`);
  revalidatePath("/settings");
  return ok("Two-factor authentication is off.");
}

/** The sign-in gate: verifies the TOTP code and upgrades the session. */
export async function verifyMfaLogin(_prev: MfaState, formData: FormData): Promise<MfaState> {
  const code = String(formData.get("code") ?? "").trim();
  if (!/^\d{6}$/.test(code)) return fail("Enter the 6-digit code from your app.");
  const supabase = await createServerSupabase();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const factor = factors?.totp?.[0];
  if (!factor) return fail("No authenticator is set up for this account.");
  const { data: challenge, error: cErr } = await supabase.auth.mfa.challenge({ factorId: factor.id });
  if (cErr || !challenge) return fail("Couldn't start verification. Try again.");
  const { error } = await supabase.auth.mfa.verify({
    factorId: factor.id,
    challengeId: challenge.id,
    code,
  });
  if (error) return fail("That code didn't match. Check your app and try again.");
  redirect("/dashboard");
}
