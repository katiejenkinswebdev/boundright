"use client";

import Link from "next/link";
import { useTransition } from "react";
import { dismissOnboarding } from "@/app/actions/onboarding-steps";

export type OnboardingStep = {
  label: string;
  href: string;
  done: boolean;
  adminOnly?: boolean;
};

/** First-run checklist: real product state, not a tour. Dismissible. */
export function GettingStarted({
  steps,
  isAdmin,
}: {
  steps: OnboardingStep[];
  isAdmin: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const visible = steps.filter((s) => !s.adminOnly || isAdmin);
  const doneCount = visible.filter((s) => s.done).length;

  return (
    <section className="mb-8 rounded-lg border border-line bg-card p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-semibold">
          Getting started · {doneCount} of {visible.length} done
        </h2>
        <button
          type="button"
          disabled={pending}
          onClick={() => startTransition(async () => void (await dismissOnboarding()))}
          className="text-sm text-ink/60 underline"
        >
          Dismiss
        </button>
      </div>
      <ol className="grid gap-2 sm:grid-cols-2">
        {visible.map((s) => (
          <li key={s.label}>
            <Link
              href={s.href}
              className={`flex items-center gap-2.5 rounded border p-3 text-sm ${
                s.done
                  ? "border-verify/40 text-ink/50"
                  : "border-line hover:border-ink"
              }`}
            >
              <span
                aria-hidden
                className={`flex h-5 w-5 items-center justify-center rounded-full border font-mono text-xs ${
                  s.done ? "border-verify bg-verify text-white" : "border-line"
                }`}
              >
                {s.done ? "✓" : ""}
              </span>
              <span className={s.done ? "line-through decoration-ink/30" : "font-medium"}>
                {s.label}
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
