"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const STAGES = [
  { key: "queued", label: "Queued" },
  { key: "extracting", label: "Reading proposal and policy" },
  { key: "comparing", label: "Comparing 40+ fields" },
  { key: "ready_for_review", label: "Building your report" },
] as const;

type CheckStatus = {
  status: string;
  failure_reason: string | null;
  label: string;
};

export function CheckProgress({
  checkId,
  initial,
}: {
  checkId: string;
  initial: CheckStatus;
}) {
  const router = useRouter();
  const [check, setCheck] = useState(initial);

  const terminal = check.status === "ready_for_review" || check.status === "reviewed" || check.status === "failed";

  useEffect(() => {
    if (terminal) {
      if (check.status !== "failed") router.refresh();
      return;
    }
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/checks/${checkId}`);
        if (res.ok) setCheck(await res.json());
      } catch {
        // transient — keep polling
      }
    }, 2500);
    return () => clearInterval(timer);
  }, [checkId, terminal, check.status, router]);

  if (check.status === "failed") {
    return (
      <div className="rounded-lg border border-flag/40 bg-card p-8 text-center">
        <p className="font-semibold text-flag">This check didn&apos;t finish.</p>
        <p className="mt-2 text-ink/80">{check.failure_reason}</p>
        <p className="mt-2 text-sm text-ink/60">
          Failed checks don&apos;t count against your limit.
        </p>
        <Link
          href="/checks/new"
          className="mt-6 inline-block rounded bg-ink px-6 py-3 font-semibold text-paper hover:bg-ink/90"
        >
          Try again
        </Link>
      </div>
    );
  }

  const activeIndex = STAGES.findIndex((s) => s.key === check.status);

  return (
    <div className="rounded-lg border border-line bg-card p-8">
      <ol className="space-y-4">
        {STAGES.map((stage, i) => {
          const done = terminal || i < activeIndex;
          const active = !terminal && i === activeIndex;
          return (
            <li key={stage.key} className="flex items-center gap-3">
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full border-2 font-mono text-xs ${
                  done
                    ? "border-verify bg-verify text-white"
                    : active
                      ? "border-ink animate-pulse"
                      : "border-line text-ink/40"
                }`}
                aria-hidden
              >
                {done ? "✓" : i + 1}
              </span>
              <span className={done || active ? "" : "text-ink/50"}>{stage.label}</span>
            </li>
          );
        })}
      </ol>
      <p className="mt-6 text-sm text-ink/60">
        Usually takes 1 to 2 minutes. You can leave; we&apos;ll email you when
        it&apos;s ready.
      </p>
    </div>
  );
}
