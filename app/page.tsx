import { EmailCaptureForm } from "@/app/components/EmailCaptureForm";

// TODO(katie): replace with the real Calendly URL before sharing the page.
const CALENDLY_URL = "https://calendly.com/boundright/free-audit";

function Stamp({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "verify" | "flag" | "caution";
}) {
  const toneClass = {
    verify: "border-verify text-verify",
    flag: "border-flag text-flag",
    caution: "border-caution text-caution",
  }[tone];
  return (
    <span
      className={`inline-block -rotate-2 rounded border-2 ${toneClass} px-2 py-0.5 font-mono text-xs font-medium uppercase tracking-wider`}
    >
      {children}
    </span>
  );
}

export default function LandingPage() {
  return (
    <main className="mx-auto w-full max-w-[1100px] flex-1 px-6">
      {/* Header */}
      <header className="flex items-center justify-between py-6">
        <span className="text-xl font-semibold tracking-tight">
          Bound<span className="text-verify">Right</span>
        </span>
        <a
          href={CALENDLY_URL}
          className="rounded border border-ink px-4 py-2 text-sm font-semibold hover:bg-ink hover:text-paper"
        >
          Book a free policy audit
        </a>
      </header>

      {/* Hero */}
      <section className="py-16 sm:py-24">
        <h1 className="max-w-2xl text-4xl font-semibold leading-tight sm:text-5xl">
          Catch policy errors before your client does.
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-ink/80">
          BoundRight compares the proposal you sold against the policy the
          carrier issued — field by field, with page citations — and hands your
          team a discrepancy report to review and confirm. Never miss a limits
          mismatch again, and prove the value every month.
        </p>
        <div className="mt-8">
          <EmailCaptureForm />
          <p className="mt-3 text-sm text-ink/60">
            14-day free trial at launch. No credit card. We process your
            documents and delete them — we keep only the findings.
          </p>
        </div>
      </section>

      {/* Demo video placeholder */}
      <section aria-label="Product demo" className="pb-16">
        <div className="flex aspect-video w-full items-center justify-center rounded-lg border border-line bg-card">
          <div className="text-center">
            <p className="font-mono text-sm uppercase tracking-wider text-ink/50">
              3-minute demo — coming this week
            </p>
            <p className="mt-2 text-ink/70">
              Watch a real proposal-vs-policy check, upload to reviewed report.
            </p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="grid gap-6 pb-16 sm:grid-cols-3">
        <div className="rounded-lg border border-line bg-card p-6">
          <Stamp tone="caution">1 · Upload</Stamp>
          <p className="mt-4 text-ink/80">
            Drop in the proposal or binder and the issued policy. Two PDFs,
            that&apos;s it.
          </p>
        </div>
        <div className="rounded-lg border border-line bg-card p-6">
          <Stamp tone="flag">2 · Review</Stamp>
          <p className="mt-4 text-ink/80">
            Get a field-by-field discrepancy report with page citations.
            Confirm or dismiss each finding — the final call is always yours.
          </p>
        </div>
        <div className="rounded-lg border border-line bg-card p-6">
          <Stamp tone="verify">3 · Prove it</Stamp>
          <p className="mt-4 text-ink/80">
            Export a reviewed, branded report for the file, and a monthly ROI
            summary that shows your principal what you caught.
          </p>
        </div>
      </section>

      {/* Free audit offer */}
      <section className="mb-16 rounded-lg border border-line bg-card p-8 sm:p-10">
        <h2 className="text-2xl font-semibold">
          Free policy audit — before you sign up for anything
        </h2>
        <p className="mt-3 max-w-2xl text-ink/80">
          Send us one recent renewal (proposal + issued policy) and we&apos;ll
          run the check with you on a 20-minute call. If it finds nothing, you
          learned your process is tight. If it finds something, you fixed it
          before your client found it.
        </p>
        <a
          href={CALENDLY_URL}
          className="mt-6 inline-block rounded bg-verify px-6 py-3 font-semibold text-white hover:bg-verify/90"
        >
          Book your free audit
        </a>
      </section>

      {/* Footer */}
      <footer className="border-t border-line py-8 text-sm text-ink/60">
        <p>
          BoundRight is a review assistant. It does not provide insurance
          advice, and final determination of coverage accuracy is the
          responsibility of the licensed agent.
        </p>
        <p className="mt-2">
          © {new Date().getFullYear()} Minds Eye Collective · Documents are
          processed and deleted; only findings are stored.
        </p>
      </footer>
    </main>
  );
}
