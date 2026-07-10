import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";

export type Profile = {
  id: string;
  user_id: string;
  agency_id: string;
  full_name: string;
  role: string;
};

export type Agency = {
  id: string;
  name: string;
  logo_url: string | null;
  avg_account_premium: number;
  manual_check_minutes: number;
  csr_hourly_rate: number;
  plan: "trial" | "founding" | "standard";
  trial_ends_at: string | null;
  checks_this_period: number;
  period_resets_at: string | null;
};

/** Redirects to /login when unauthenticated. */
export async function requireUser() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

/**
 * Redirects to /login when unauthenticated and to /onboarding when the
 * user has no agency yet. Use on every app screen except onboarding.
 */
export async function requireProfile() {
  const { supabase, user } = await requireUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle<Profile>();
  if (!profile) redirect("/onboarding");

  const { data: agency } = await supabase
    .from("agencies")
    .select("*")
    .eq("id", profile.agency_id)
    .single<Agency>();
  if (!agency) redirect("/onboarding");

  return { supabase, user, profile, agency };
}
