import Link from "next/link";

export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <main className="flex flex-1 flex-col items-center px-6 py-12">
      <Link href="/" className="mb-8 text-2xl font-semibold tracking-tight">
        Bound<span className="text-verify">Right</span>
      </Link>
      <div className="w-full max-w-md rounded-lg border border-line bg-card p-8">
        {children}
      </div>
    </main>
  );
}
