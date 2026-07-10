import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { OnboardingForm } from "./OnboardingForm";

export default async function OnboardingPage() {
  const { supabase, user } = await requireUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (profile) redirect("/dashboard");

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-12">
      <div className="w-full max-w-md">
        <h1 className="mb-2 text-2xl font-semibold">Set up your agency</h1>
        <p className="mb-8 text-ink/70">
          One quick screen and you&apos;re in.
        </p>
        <div className="rounded-lg border border-line bg-card p-8">
          <OnboardingForm />
        </div>
      </div>
    </main>
  );
}
