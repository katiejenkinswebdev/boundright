import Link from "next/link";
import { Lockup } from "@/app/components/brand";

export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <main className="flex flex-1 flex-col items-center px-6 py-12">
      <Link href="/" className="mb-8">
        <Lockup />
      </Link>
      <div className="w-full max-w-md rounded-lg border border-line bg-card p-8">
        {children}
      </div>
    </main>
  );
}
