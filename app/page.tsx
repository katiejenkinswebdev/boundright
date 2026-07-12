import Link from "next/link";
import { EmailCaptureForm } from "@/app/components/EmailCaptureForm";
import { Lockup, Wordmark } from "@/app/components/brand";

// TODO(katie): replace with the real Calendly URL before sharing the page.
const CALENDLY_URL = "https://calendly.com/boundright/free-audit";

export default function LandingPage() {
  return (
    <main className="mx-auto w-full max-w-[1100px] flex-1 px-6">
      {/* Header */}
      <header className="flex items-center justify-between py-6">
        <Lockup />
        <div className="flex items-center gap-4">
          <a href="#pricing" className="text-sm underline">
            Pricing
          </a>
          <Link
            href="/login"
            className="rounded border border-ink px-4 py-2 text-sm font-semibold hover:bg-ink hover:text-paper"
          >
            Sign in
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="py-16 sm:py-24">
        <h1 className="max-w-2xl text-4xl font-semibold leading-tight sm:text-5xl">
          Was it bound right?
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-ink/80">
          BoundRight compares the proposal you sold against the policy the
          carrier issued, field by field, with a page citation for every
          finding. Your licensed agent reviews the report, stamps it, and files
          it as E&amp;O documentation.
        </p>
        <div className="mt-8">
          <EmailCaptureForm />
          <p className="mt-3 text-sm text-ink/60">
            14-day free trial at launch. No credit card. We process your
            documents and delete them. We keep only the findings.
          </p>
        </div>
      </section>

      {/* Demo video placeholder */}
      <section aria-label="Product demo" className="pb-16">
        <div className="flex aspect-video w-full items-center justify-center rounded-lg border border-line bg-card">
          <div className="text-center">
            <p className="font-mono text-sm uppercase tracking-wider text-ink/50">
              3-minute demo, coming this week
            </p>
            <p className="mt-2 text-ink/70">
              Watch a real proposal-vs-policy check, upload to reviewed report.
            </p>
          </div>
        </div>
      </section>

      {/* How it works — quiet, numbered; boldness is reserved for the stamp */}
      <section className="grid gap-6 pb-16 sm:grid-cols-3">
        {[
          {
            n: "01",
            title: "Upload",
            body: "Drop in the proposal or binder and the issued policy. Two PDFs, that's it.",
          },
          {
            n: "02",
            title: "Review",
            body: "Get a field-by-field discrepancy report with page citations. Confirm or dismiss each finding. The final call is always yours.",
          },
          {
            n: "03",
            title: "File the proof",
            body: "Export a reviewed, stamped report for the E&O file, and a monthly report that shows your principal what you caught.",
          },
        ].map((step) => (
          <div key={step.n} className="rounded-lg border border-line bg-card p-6">
            <p className="font-mono text-sm text-ink/50">{step.n}</p>
            <h2 className="mt-1 text-lg font-semibold">{step.title}</h2>
            <p className="mt-2 text-ink/80">{step.body}</p>
          </div>
        ))}
      </section>

      {/* Pricing — public, never behind a demo call */}
      <section id="pricing" className="pb-16">
        <h2 className="text-2xl font-semibold">Public pricing</h2>
        <p className="mt-2 max-w-2xl text-ink/70">
          No demo call required. Start a trial, check real renewals, decide for
          yourself.
        </p>
        <div className="mt-6 grid gap-6 sm:grid-cols-3">
          <div className="rounded-lg border border-line bg-card p-6">
            <h3 className="font-semibold">Trial</h3>
            <p className="mt-2 text-3xl font-semibold">$0</p>
            <p className="mt-1 text-sm text-ink/60">14 days · 10 checks</p>
            <p className="mt-4 text-sm text-ink/80">
              No credit card. Every feature, including exported reports.
            </p>
          </div>
          <div className="rounded-lg border-2 border-ink bg-card p-6">
            <h3 className="font-semibold">Founding</h3>
            <p className="mt-2 text-3xl font-semibold">
              $249<span className="text-base font-normal text-ink/60">/mo</span>
            </p>
            <p className="mt-1 text-sm text-ink/60">150 checks per month</p>
            <p className="mt-4 text-sm text-ink/80">
              For the first agencies on board. The price stays locked in.
            </p>
          </div>
          <div className="rounded-lg border border-line bg-card p-6">
            <h3 className="font-semibold">Standard</h3>
            <p className="mt-2 text-3xl font-semibold">
              $349<span className="text-base font-normal text-ink/60">/mo</span>
            </p>
            <p className="mt-1 text-sm text-ink/60">150 checks per month</p>
            <p className="mt-4 text-sm text-ink/80">
              Cancel anytime in one click. When a limit is reached, checks
              pause. We never bill overages.
            </p>
          </div>
        </div>
      </section>

      {/* Free audit offer */}
      <section className="mb-16 rounded-lg border border-line bg-card p-8 sm:p-10">
        <h2 className="text-2xl font-semibold">
          Free policy audit, before you sign up for anything
        </h2>
        <p className="mt-3 max-w-2xl text-ink/80">
          Send us one recent renewal (proposal and issued policy) and we&apos;ll
          run the check with you on a 20-minute call. If it finds nothing, you
          learned your process is tight. If it finds something, you fixed it
          before your client found it.
        </p>
        <a
          href={CALENDLY_URL}
          className="mt-6 inline-block rounded bg-ink px-6 py-3 font-semibold text-paper hover:bg-ink/90"
        >
          Book your free audit
        </a>
      </section>

      {/* Footer */}
      <footer className="border-t border-line py-8 text-sm text-ink/60">
        <p className="mb-2 text-base text-ink">
          <Wordmark /> <span className="text-ink/60">· Every account. Bound right.</span>
        </p>
        <p>
          BoundRight is a review assistant. It does not provide insurance
          advice, and final determination of coverage accuracy is the
          responsibility of the licensed agent.
        </p>
        <p className="mt-2">
          © {new Date().getFullYear()} Minds Eye Collective · Documents are
          processed and deleted; only findings are stored ·{" "}
          <Link href="/terms" className="underline">
            Terms
          </Link>{" "}
          ·{" "}
          <Link href="/privacy" className="underline">
            Privacy
          </Link>{" "}
          ·{" "}
          <Link href="/ai" className="underline">
            How we use AI
          </Link>
        </p>
      </footer>
    </main>
  );
}
