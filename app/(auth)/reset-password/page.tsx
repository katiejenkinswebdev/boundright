import Link from "next/link";
import { ResetForm } from "./ResetForm";

export default function ResetPasswordPage() {
  return (
    <>
      <h1 className="mb-2 text-2xl font-semibold">Reset your password</h1>
      <p className="mb-6 text-sm text-ink/70">
        Enter the email you signed up with and we&apos;ll send a reset link.
      </p>
      <ResetForm />
      <p className="mt-6 border-t border-line pt-4 text-sm">
        <Link href="/login" className="underline">
          Back to sign in
        </Link>
      </p>
    </>
  );
}
