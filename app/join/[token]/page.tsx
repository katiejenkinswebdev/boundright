import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { acceptInvite } from "@/app/actions/team";
import { Lockup } from "@/app/components/brand";

export default async function JoinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/signup?next=/join/${token}`);

  const error = await acceptInvite(token); // redirects to /dashboard on success

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-12">
      <Link href="/" className="mb-8">
        <Lockup />
      </Link>
      <div className="w-full max-w-md rounded-lg border border-line bg-card p-8 text-center">
        <p className="text-flag">{error}</p>
        <Link href="/login" className="mt-4 inline-block text-sm underline">
          Sign in with a different account
        </Link>
      </div>
    </main>
  );
}
