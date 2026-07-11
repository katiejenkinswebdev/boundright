import Link from "next/link";
import { Lockup } from "@/app/components/brand";

export const metadata = { title: "Privacy Policy · BoundRight" };

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
      <Link href="/">
        <Lockup />
      </Link>
      <h1 className="mt-8 text-2xl font-semibold">Privacy Policy</h1>
      <p className="mt-2 text-sm text-ink/60">
        Draft, under attorney review. Effective upon publication.
      </p>
      <div className="mt-6 space-y-4 text-[15px] leading-relaxed text-ink/90">
        <p>
          <strong>Documents.</strong> We process your uploaded documents and
          delete them. Deletion happens immediately after a check completes,
          success or failure, and is verified by a nightly job. We keep only
          the file names and the findings.
        </p>
        <p>
          <strong>What we store.</strong> Your account details, agency settings,
          check labels, findings (field names, values, page numbers, reviewer
          decisions and notes), and usage events. Data lives in our database
          hosted on Supabase, isolated per agency with row-level security.
        </p>
        <p>
          <strong>What we never store.</strong> Full documents after
          processing, card numbers (payments are handled by Stripe), or
          document content in logs and error monitoring.
        </p>
        <p>
          <strong>AI processing.</strong> Document text is sent to Anthropic&apos;s
          Claude API to extract and compare fields. We do not use third-party
          analytics; usage events stay in our own database.
        </p>
        <p>
          <strong>Email.</strong> Transactional email (check-ready, monthly
          reports, billing notices) is sent via Resend to the addresses on your
          account.
        </p>
        <p>
          <strong>Deletion.</strong> Delete your account any time from
          Settings; it removes your agency and all associated data. Canceled
          subscriptions keep read-only access for 90 days, then data is deleted
          after two warning emails.
        </p>
        <p>
          Running due diligence? Download the{" "}
          <a className="underline" href="/boundright-data-processing.pdf">
            data processing one-pager
          </a>{" "}
          (what we store, what we delete, where it lives).
        </p>
        <p>
          Questions? <a className="underline" href="mailto:help@boundright.app">help@boundright.app</a>
        </p>
      </div>
    </main>
  );
}
