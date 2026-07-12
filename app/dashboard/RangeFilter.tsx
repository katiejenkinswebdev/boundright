"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

const PRESETS = [
  ["7d", "Week"],
  ["1m", "Month"],
  ["3m", "3 months"],
  ["6m", "6 months"],
  ["1y", "Year"],
] as const;

/** Time-range filter for every windowed dashboard metric. URL-driven. */
export function RangeFilter() {
  const router = useRouter();
  const params = useSearchParams();
  const activeRange = params.get("from") ? "custom" : (params.get("range") ?? "6m");
  const [showCustom, setShowCustom] = useState(!!params.get("from"));
  const [from, setFrom] = useState(params.get("from") ?? "");
  const [to, setTo] = useState(params.get("to") ?? "");

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Date range">
      {PRESETS.map(([value, label]) => (
        <button
          key={value}
          type="button"
          onClick={() => {
            setShowCustom(false);
            router.push(`/dashboard?range=${value}`);
          }}
          aria-pressed={activeRange === value}
          className={`rounded px-3 py-1.5 text-sm font-medium ${
            activeRange === value
              ? "bg-ink text-paper"
              : "border border-line text-ink/70 hover:border-ink"
          }`}
        >
          {label}
        </button>
      ))}
      <button
        type="button"
        onClick={() => setShowCustom((v) => !v)}
        aria-pressed={activeRange === "custom"}
        className={`rounded px-3 py-1.5 text-sm font-medium ${
          activeRange === "custom"
            ? "bg-ink text-paper"
            : "border border-line text-ink/70 hover:border-ink"
        }`}
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
            className="rounded border border-line bg-card px-2 py-1 text-sm"
          />
          <span className="text-ink/50">to</span>
          <label className="sr-only" htmlFor="range-to">To</label>
          <input
            id="range-to"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded border border-line bg-card px-2 py-1 text-sm"
          />
          <button
            type="button"
            disabled={!from || !to}
            onClick={() => router.push(`/dashboard?from=${from}&to=${to}`)}
            className="rounded bg-ink px-3 py-1.5 text-sm font-semibold text-paper disabled:opacity-50"
          >
            Apply
          </button>
        </span>
      )}
    </div>
  );
}
