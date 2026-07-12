import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { Lockup } from "@/app/components/brand";
import { MfaLoginForm } from "./MfaLoginForm";

/**
 * The second lock: users with an enrolled authenticator land here after
 * their password until the code checks out. Uses requireUser (not
 * requireProfile) so it can't loop with the AAL gate.
 */
export default async function MfaPage() {
  const { supabase } = await requireUser();
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel === "aal2" || aal?.nextLevel !== "aal2") redirect("/dashboard");

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-16">
      <Lockup />
      <h1 className="mt-8 text-xl font-semibold">Enter your code</h1>
      <p className="mt-2 text-sm text-ink/70">
        Two-factor authentication is on for this account. Open your
        authenticator app and enter the 6-digit code.
      </p>
      <MfaLoginForm />
    </main>
  );
}
