"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";

const PRESETS = [
  ["7d", "Week"],
  ["1m", "Month"],
  ["3m", "3 months"],
  ["6m", "6 months"],
  ["1y", "Year"],
] as const;

const chip = (active: boolean) =>
  `rounded px-3 py-1.5 text-sm font-medium ${
    active ? "bg-ink text-paper" : "border border-line text-ink/70 hover:border-ink"
  }`;

/**
 * Time-range filter, URL-driven and page-agnostic: it preserves the page's
 * other query params (status, type, sort, search) and resets pagination.
 * `allowAll` adds an "All time" chip and makes it the default (checks list);
 * without it the dashboard default of 6m applies.
 */
export function RangeFilter({ allowAll = false }: { allowAll?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const activeRange = params.get("from")
    ? "custom"
    : (params.get("range") ?? (allowAll ? "all" : "6m"));
  const [showCustom, setShowCustom] = useState(!!params.get("from"));
  const [from, setFrom] = useState(params.get("from") ?? "");
  const [to, setTo] = useState(params.get("to") ?? "");

  const go = (overrides: Record<string, string | null>) => {
    const p = new URLSearchParams(params.toString());
    p.delete("page");
    for (const [k, v] of Object.entries(overrides)) {
      if (v === null) p.delete(k);
      else p.set(k, v);
    }
    const qs = p.toString();
    router.push(`${pathname}${qs ? `?${qs}` : ""}`);
  };

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Date range">
      {allowAll && (
        <button
          type="button"
          onClick={() => {
            setShowCustom(false);
            go({ range: null, from: null, to: null });
          }}
          aria-pressed={activeRange === "all"}
          className={chip(activeRange === "all")}
        >
          All time
        </button>
      )}
      {PRESETS.map(([value, label]) => (
        <button
          key={value}
          type="button"
          onClick={() => {
            setShowCustom(false);
            go({ range: value, from: null, to: null });
          }}
          aria-pressed={activeRange === value}
          className={chip(activeRange === value)}
        >
          {label}
        </button>
      ))}
      <button
        type="button"
        onClick={() => setShowCustom((v) => !v)}
        aria-pressed={activeRange === "custom"}
        className={chip(activeRange === "custom")}
      >
        Custom
      </button>
      {showCustom && (
        <span className="flex items-center gap-2">
          <label className="sr-only" htmlFor="range-from">From</label>
          <input
            id="range-from"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded border border-line bg-card px-3 py-1.5 font-sans text-sm text-ink accent-ink"
          />
          <span className="text-ink/50">to</span>
          <label className="sr-only" htmlFor="range-to">To</label>
          <input
            id="range-to"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded border border-line bg-card px-3 py-1.5 font-sans text-sm text-ink accent-ink"
          />
          <button
            type="button"
            disabled={!from || !to}
            onClick={() => go({ from, to, range: null })}
            className="rounded bg-ink px-3 py-1.5 text-sm font-semibold text-paper disabled:opacity-50"
          >
            Apply
          </button>
        </span>
      )}
    </div>
  );
}
