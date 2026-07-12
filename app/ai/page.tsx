import Link from "next/link";
import { Lockup } from "@/app/components/brand";

export const metadata = { title: "How we use AI · BoundRight" };

/**
 * The AI transparency page: written at a middle-school reading level on
 * purpose, because trust documents that need a lawyer to decode don't
 * build trust.
 */
export default function AiTransparencyPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
      <Link href="/">
        <Lockup />
      </Link>
      <h1 className="mt-8 text-2xl font-semibold">How BoundRight uses AI</h1>
      <p className="mt-2 text-sm text-ink/60">
        Written in plain language on purpose. Last updated July 2026.
      </p>

      <div className="mt-6 space-y-6 text-[16px] leading-relaxed text-ink/90">
        <section>
          <h2 className="mb-2 text-lg font-semibold">What the AI actually does</h2>
          <p>
            When you upload two insurance documents, an AI (Claude, made by
            Anthropic) reads them the way a careful person would. It writes
            down the important facts from each one: who is insured, the dates,
            the dollar limits, the deductibles, and the list of forms. Then it
            puts the two lists side by side and points out every place they
            don&apos;t match. For every difference it finds, it must say which
            page it found it on, so you can go look for yourself.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">What the AI is not allowed to do</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              It cannot guess. If a fact isn&apos;t in the document, it has to
              leave it blank instead of making something up.
            </li>
            <li>
              It cannot make the final call. Every difference it finds waits
              for a licensed insurance professional to look at it and click
              Confirm or Dismiss. Nothing goes into a report as true until a
              human says so.
            </li>
            <li>
              It cannot give insurance advice. It compares documents. Your
              agent decides what the differences mean.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">How we double-check it</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>A second AI pass.</strong> The most serious findings get
              checked a second time against the exact page they came from. If
              the second check disagrees, we lower the confidence label so your
              reviewer knows to look closely.
            </li>
            <li>
              <strong>Receipts.</strong> Every finding shows its page number
              and a short quote from the document, so you never have to just
              take the AI&apos;s word for it.
            </li>
            <li>
              <strong>Practice tests.</strong> Before we change anything about
              how the AI works, we run it against practice documents where we
              already know every error. It has to find all of them, with zero
              false alarms on the serious ones, or the change doesn&apos;t ship.
            </li>
            <li>
              <strong>A paper trail.</strong> Every report records exactly
              which AI version checked it, so we can always trace how an
              answer was produced.
            </li>
            <li>
              <strong>You teach it.</strong> When a reviewer dismisses a
              finding as wrong, we record why. That record helps us fix
              mistakes so they don&apos;t happen again.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">What happens to your documents</h2>
          <p>
            Your documents are sent to Anthropic&apos;s Claude service to be
            read, and then we delete the files, every time, whether the check
            worked or failed. A separate job checks every night that nothing
            was missed. We keep only the findings, short quotes around them,
            and a digital fingerprint of each file so a report can be proven
            authentic later. Your documents are never used to train AI models.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">When you drop in a pile of documents</h2>
          <p>
            Some agencies turn on smart intake: you drop many unlabeled PDFs at
            once, and the AI reads the first pages of each to figure out what
            it is and who it covers, then suggests which documents belong
            together. Those suggestions are only suggestions. You see every
            proposed pair with a confidence label, fix anything wrong, and
            nothing is compared until you confirm. Documents that have no
            partner are shown to you, then deleted, and any staged file that
            never runs is removed automatically within 48 hours.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">Where AI writes words for you</h2>
          <p>
            One feature drafts a letter to the insurance carrier asking them to
            fix confirmed mistakes. The AI writes the first draft from findings
            your reviewer already confirmed, and it appears in an editing box,
            never sent automatically. You read it, change it, and send it
            yourself, under your own name.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">When the AI is wrong</h2>
          <p>
            Sometimes it will be. That&apos;s why the reviewer step exists, and
            why every number on your dashboard only counts findings a human
            confirmed. If you spot a wrong finding, dismiss it with the reason,
            or use the Send feedback button and choose &quot;a finding was
            wrong.&quot; A human reads every one.
          </p>
        </section>

        <p className="border-t border-line pt-4 text-sm text-ink/60">
          Questions about any of this?{" "}
          <a className="underline" href="mailto:help@boundright.app">
            help@boundright.app
          </a>
          . See also our <Link href="/privacy" className="underline">Privacy Policy</Link> and
          the <a href="/boundright-data-processing.pdf" className="underline">data processing one-pager</a>.
        </p>
      </div>
    </main>
  );
}
