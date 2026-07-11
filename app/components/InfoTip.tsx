"use client";

import { useState } from "react";

/**
 * Accessible inline explainer: a small "?" button that toggles a plain-
 * language note. Used anywhere a number or term needs its math or meaning
 * shown, never hover-only.
 */
export function InfoTip({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={label}
        className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full border border-line align-middle font-mono text-[10px] text-ink/60 hover:border-ink hover:text-ink"
      >
        ?
      </button>
      {open && (
        <span className="absolute left-0 top-6 z-20 block w-64 rounded border border-line bg-card p-3 text-left text-xs font-normal normal-case leading-relaxed text-ink/80 shadow-sm">
          {children}
        </span>
      )}
    </span>
  );
}
