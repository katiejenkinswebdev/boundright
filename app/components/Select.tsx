"use client";

import { useEffect, useRef, useState } from "react";

/**
 * On-brand select: quiet bordered trigger with an evenly-spaced chevron and
 * a styled menu (native <select> menus can't be themed). Click-outside and
 * Escape close it; the chosen option is marked.
 */
export function Select({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: string;
  options: readonly (readonly [string, string])[];
  onChange: (value: string) => void;
  ariaLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const current = options.find(([v]) => v === value)?.[1] ?? value;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2.5 rounded border border-line bg-card px-3 py-2 text-sm text-ink hover:border-ink"
      >
        {current}
        <svg
          viewBox="0 0 12 12"
          aria-hidden
          className={`h-3 w-3 shrink-0 text-ink/50 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </button>
      {open && (
        <ul
          role="listbox"
          aria-label={ariaLabel}
          className="absolute left-0 top-full z-20 mt-1 min-w-full whitespace-nowrap rounded-lg border border-line bg-card py-1 shadow-md"
        >
          {options.map(([v, label]) => (
            <li key={v} role="option" aria-selected={v === value}>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onChange(v);
                }}
                className={`flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left text-sm hover:bg-paper ${
                  v === value ? "font-semibold text-ink" : "text-ink/80"
                }`}
              >
                {label}
                {v === value && <span className="font-mono text-xs text-verify">✓</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
