"use client";

import { useState } from "react";

/**
 * Instant styled tooltip around arbitrary content (no "?" button). For
 * dense spots like table pills where the browser-native title delay reads
 * as broken. Opens on hover and keyboard focus.
 */
export function HoverTip({ tip, children }: { tip: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <span
      className="relative inline-block"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      tabIndex={0}
    >
      {children}
      {open && (
        <span
          role="tooltip"
          className="absolute left-0 top-full z-20 mt-1.5 block w-72 rounded-lg border border-line bg-card p-3 text-left text-[13px] font-normal normal-case tracking-normal leading-relaxed text-ink shadow-md"
        >
          {tip}
        </span>
      )}
    </span>
  );
}

/**
 * Inline explainer shown on hover and on keyboard focus. Plain-language
 * notes for any number or term; never hover-only (focus works too).
 */
export function InfoTip({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <span
      className="relative inline-block"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        aria-label={label}
        className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full border border-line align-middle font-mono text-[10px] text-ink/60 hover:border-ink hover:text-ink"
      >
        ?
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute left-0 top-7 z-20 block w-80 rounded-lg border border-line bg-card p-4 text-left text-[13px] font-normal normal-case tracking-normal leading-relaxed text-ink shadow-md"
        >
          {children}
        </span>
      )}
    </span>
  );
}
