"use server";

import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type OnboardingState = {
  status: "idle" | "error";
  message: string;
};

const TRIAL_DAYS = 14;

function firstOfNextMonth(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
}

export async function completeOnboarding(
  _prev: OnboardingState,
  formData: FormData
): Promise<OnboardingState> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const name = String(formData.get("agency_name") ?? "").trim();
  const manualMinutes = Number(formData.get("manual_check_minutes") ?? 45);
  const avgPremium = Number(formData.get("avg_account_premium") ?? 25000);
  const hourlyRate = Number(formData.get("csr_hourly_rate") ?? 35);

  if (!name) return { status: "error", message: "Enter your agency's name." };
  for (const [label, v] of [
    ["Manual check time", manualMinutes],
    ["Average account premium", avgPremium],
    ["CSR hourly rate", hourlyRate],
  ] as const) {
    if (!Number.isFinite(v) || v <= 0) {
      return { status: "error", message: `${label} must be a number above zero.` };
    }
  }

  // Agency + profile creation runs with the service role: the user has no
  // agency yet, so RLS (correctly) won't let them insert one.
  const admin = createAdminClient();
  if (!admin) {
    return {
      status: "error",
      message: "The server isn't fully configured yet. Try again shortly.",
    };
  }

  const { data: existing } = await admin
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (existing) redirect("/dashboard");

  const trialEnds = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
  const { data: agency, error: agencyError } = await admin
    .from("agencies")
    .insert({
      name,
      manual_check_minutes: Math.round(manualMinutes),
      avg_account_premium: avgPremium,
      csr_hourly_rate: hourlyRate,
      plan: "trial",
      trial_ends_at: trialEnds.toISOString(),
      period_resets_at: firstOfNextMonth().toISOString(),
    })
    .select("id")
    .single();

  if (agencyError || !agency) {
    return { status: "error", message: "Couldn't save your agency. Try again." };
  }

  const fullName =
    (user.user_metadata?.full_name as string | undefined) ?? user.email ?? "Owner";
  const { error: profileError } = await admin.from("profiles").insert({
    user_id: user.id,
    agency_id: agency.id,
    full_name: fullName,
    role: "admin",
  });

  if (profileError) {
    // Don't leave an orphaned agency behind.
    await admin.from("agencies").delete().eq("id", agency.id);
    return { status: "error", message: "Couldn't finish setup. Try again." };
  }

  await admin.from("events").insert({
    agency_id: agency.id,
    user_id: user.id,
    event_name: "signup_completed",
    metadata: {},
  });

  redirect("/dashboard");
}
