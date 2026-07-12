import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { Lockup } from "@/app/components/brand";
import { ChangePasswordForm } from "./ChangePasswordForm";

/**
 * First-login stop for operator-provisioned accounts: the default password
 * must be replaced before anything else. Uses requireUser so it can't loop
 * with the requireProfile gate.
 */
export default async function ChangePasswordPage() {
  const { supabase, user } = await requireUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("must_change_password")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile?.must_change_password) redirect("/dashboard");

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-16">
      <Lockup />
      <h1 className="mt-8 text-xl font-semibold">Choose your password</h1>
      <p className="mt-2 text-sm text-ink/70">
        You signed in with a temporary password. Set your own to continue;
        you&apos;ll use it from now on.
      </p>
      <ChangePasswordForm />
    </main>
  );
}
