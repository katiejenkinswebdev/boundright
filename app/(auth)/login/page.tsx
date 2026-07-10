import Link from "next/link";
import { LoginForm } from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const next = params.next?.startsWith("/") ? params.next : "/dashboard";

  return (
    <>
      <h1 className="mb-6 text-2xl font-semibold">Sign in</h1>
      {params.error && (
        <p role="alert" className="mb-4 text-flag text-sm">
          {params.error}
        </p>
      )}
      <LoginForm next={next} />
      <p className="mt-6 border-t border-line pt-4 text-sm">
        New to BoundRight?{" "}
        <Link href="/signup" className="underline">
          Start your free trial
        </Link>
      </p>
    </>
  );
}
