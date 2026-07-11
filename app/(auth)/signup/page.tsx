import Link from "next/link";
import { SignupForm } from "./SignupForm";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <>
      <h1 className="mb-6 text-2xl font-semibold">Start your free trial</h1>
      <SignupForm next={next?.startsWith("/") ? next : ""} />
      <p className="mt-6 border-t border-line pt-4 text-sm">
        Already have an account?{" "}
        <Link href="/login" className="underline">
          Sign in
        </Link>
      </p>
    </>
  );
}
