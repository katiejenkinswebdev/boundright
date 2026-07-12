import Link from "next/link";
import { PLANS } from "@/lib/pricing";
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
          <a href="#features" className="mr-4 text-sm underline">
            Features
          </a>
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

      {/* Features → outcomes, organized by the job the agency is doing */}
      <section id="features" className="pb-16">
        <h2 className="text-2xl font-semibold">Built for the work, measured in outcomes</h2>
        <p className="mt-2 max-w-2xl text-ink/70">
          Every feature exists to close one of four gaps in the E&amp;O story.
          AI proposes; your licensed reviewer decides. AI can make mistakes.
          Verify important information.
        </p>
        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          {[
            {
              use: "Catch issuance errors before your client does",
              features:
                "Field-by-field comparison of proposal and issued policy across 40+ fields, a second AI verification pass on every critical, extraction confidence on each finding, and page-cited source excerpts.",
              outcome:
                "Wrong limits, missing endorsements, and bad dates surface in about two minutes instead of at claim time.",
            },
            {
              use: "Prove the account was bound right",
              features:
                "Reviewer confirm/dismiss decisions with recorded reasons, exported reports with document SHA-256 fingerprints, a full audit trail, reviewer certification, and your agency logo co-branded on every page.",
              outcome:
                "A dated, defensible E&O file for every account, generated as a by-product of work you already do.",
            },
            {
              use: "Fix what the carrier got wrong",
              features:
                "Correction request letters drafted from your confirmed findings in carrier-standard language, corrections requested effective inception, editable before anything is sent.",
              outcome:
                "The follow-up letter that used to take an hour is a two-minute review and paste.",
            },
            {
              use: "Run the whole book, not one file at a time",
              features:
                "Smart intake classifies and pairs a whole pile of unlabeled PDFs, renewal and certificate checks, carrier accuracy trends, date-range analytics, and monthly co-branded summary reports.",
              outcome:
                "Renewal season stops being a triage problem; leadership sees hours and dollars saved per period.",
            },
          ].map((card) => (
            <div key={card.use} className="rounded-lg border border-line bg-card p-6">
              <h3 className="font-semibold">{card.use}</h3>
              <p className="mt-2 text-sm text-ink/80">{card.features}</p>
              <p className="mt-3 text-sm">
                <span className="font-mono text-xs uppercase tracking-wide text-verify">Outcome</span>{" "}
                <span className="text-ink/90">{card.outcome}</span>
              </p>
            </div>
          ))}
        </div>
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
            <h3 className="font-semibold">{PLANS.trial.name}</h3>
            <p className="mt-2 text-3xl font-semibold">${PLANS.trial.monthly}</p>
            <p className="mt-1 text-sm text-ink/60">
              {PLANS.trial.trialDays} days · {PLANS.trial.checksPerMonth} checks
            </p>
            <p className="mt-4 text-sm text-ink/80">{PLANS.trial.blurb}</p>
          </div>
          <div className="rounded-lg border-2 border-ink bg-card p-6">
            <h3 className="font-semibold">{PLANS.founding.name}</h3>
            <p className="mt-2 text-3xl font-semibold">
              ${PLANS.founding.monthly}<span className="text-base font-normal text-ink/60">/mo</span>
            </p>
            <p className="mt-1 text-sm text-ink/60">{PLANS.founding.checksPerMonth} checks per month</p>
            <p className="mt-4 text-sm text-ink/80">{PLANS.founding.blurb}</p>
          </div>
          <div className="rounded-lg border border-line bg-card p-6">
            <h3 className="font-semibold">{PLANS.standard.name}</h3>
            <p className="mt-2 text-3xl font-semibold">
              ${PLANS.standard.monthly}<span className="text-base font-normal text-ink/60">/mo</span>
            </p>
            <p className="mt-1 text-sm text-ink/60">{PLANS.standard.checksPerMonth} checks per month</p>
            <p className="mt-4 text-sm text-ink/80">{PLANS.standard.blurb}</p>
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
