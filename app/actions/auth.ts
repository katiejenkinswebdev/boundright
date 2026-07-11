"use server";

import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";

export type AuthFormState = {
  status: "idle" | "ok" | "error";
  message: string;
};

const idleOk = (message: string): AuthFormState => ({ status: "ok", message });
const fail = (message: string): AuthFormState => ({ status: "error", message });

function appUrl(path: string): string {
  return `${process.env.APP_URL ?? "http://localhost:3000"}${path}`;
}

export async function signUp(
  _prev: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const acceptedTerms = formData.get("accept_terms") === "on";
  const nextParam = String(formData.get("next") ?? "");
  const next = nextParam.startsWith("/") ? nextParam : "/onboarding";

  if (!fullName) return fail("Enter your name so reports can credit the reviewer.");
  if (!email) return fail("Enter your work email.");
  if (password.length < 8) return fail("Use a password of at least 8 characters.");
  if (!acceptedTerms) return fail("Please accept the Terms of Service to continue.");

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: appUrl(`/auth/callback?next=${encodeURIComponent(next)}`),
    },
  });

  if (error) return fail(error.message);

  // Email confirmation on: no session yet, tell them to check their inbox.
  if (!data.session) {
    return idleOk("Check your email to confirm your account, then sign in.");
  }

  redirect(next);
}

export async function signIn(
  _prev: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/dashboard");

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return fail("That email and password don't match. Try again, or use the reset link below.");
  }

  redirect(next.startsWith("/") ? next : "/dashboard");
}

export async function sendMagicLink(
  _prev: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) return fail("Enter your email and we'll send you a sign-in link.");

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: appUrl("/auth/callback?next=/dashboard") },
  });
  if (error) return fail(error.message);
  return idleOk("Sign-in link sent. Check your email.");
}

export async function requestPasswordReset(
  _prev: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) return fail("Enter the email you signed up with.");

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: appUrl("/auth/callback?next=/update-password"),
  });
  if (error) return fail(error.message);
  return idleOk("Reset link sent. Check your email.");
}

export async function updatePassword(
  _prev: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) return fail("Use a password of at least 8 characters.");

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return fail(error.message);

  redirect("/dashboard");
}

export async function signOut(): Promise<void> {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  redirect("/login");
}
