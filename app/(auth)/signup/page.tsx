import Link from "next/link";
import { SignupForm } from "./SignupForm";

export default function SignupPage() {
  return (
    <>
      <h1 className="mb-6 text-2xl font-semibold">Start your free trial</h1>
      <SignupForm />
      <p className="mt-6 border-t border-line pt-4 text-sm">
        Already have an account?{" "}
        <Link href="/login" className="underline">
          Sign in
        </Link>
      </p>
    </>
  );
}
