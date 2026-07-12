"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Select } from "@/app/components/Select";

const STATUS_OPTIONS = [
  ["all", "All statuses"],
  ["ready_for_review", "Needs review"],
  ["reviewed", "Reviewed"],
  ["failed", "Failed"],
  ["archived", "Archived"],
] as const;
const TYPE_OPTIONS = [
  ["all", "All types"],
  ["issuance", "Issuance"],
  ["renewal", "Renewal"],
  ["coi", "Certificate"],
] as const;
const DATE_OPTIONS = [
  ["all", "All time"],
  ["7d", "Past week"],
  ["1m", "Past month"],
  ["3m", "Past 3 months"],
  ["6m", "Past 6 months"],
  ["1y", "Past year"],
  ["custom", "Custom dates"],
] as const;

const fieldClass =
  "rounded border border-line bg-card px-3 py-2 text-sm text-ink hover:border-ink";

/**
 * The checks-list filter toolbar: search + status + type + date in a single
 * quiet row (custom dates unfold a second row only while chosen). URL-driven;
 * every change resets pagination and preserves the other filters.
 */
export function FiltersBar({
  q,
  status,
  type,
  range,
  from,
  to,
}: {
  q: string;
  status: string;
  type: string;
  range: string;
  from: string;
  to: string;
}) {
  const router = useRouter();
  const [search, setSearch] = useState(q);
  const dateValue = from ? "custom" : range || "all";
  const [customOpen, setCustomOpen] = useState(!!from);
  const [fromDraft, setFromDraft] = useState(from);
  const [toDraft, setToDraft] = useState(to);

  const go = (over: Record<string, string>) => {
    const merged: Record<string, string> = {
      q: search.trim(),
      status,
      type,
      range,
      from,
      to,
      ...over,
    };
    const p = new URLSearchParams();
    if (merged.q) p.set("q", merged.q);
    if (merged.status !== "all") p.set("status", merged.status);
    if (merged.type !== "all") p.set("type", merged.type);
    if (merged.from) {
      p.set("from", merged.from);
      if (merged.to) p.set("to", merged.to);
    } else if (merged.range && merged.range !== "all") {
      p.set("range", merged.range);
    }
    const qs = p.toString();
    router.push(`/checks${qs ? `?${qs}` : ""}`);
  };

  const filtered =
    q !== "" || status !== "all" || type !== "all" || !!from || (range && range !== "all");

  return (
    <div className="mb-4 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && go({ q: search.trim() })}
          onBlur={() => search.trim() !== q && go({ q: search.trim() })}
          placeholder="Search client or account…"
          aria-label="Search by client or account name"
          className={`${fieldClass} w-full max-w-60 flex-1`}
        />
        <Select
          value={customOpen ? "custom" : dateValue}
          options={DATE_OPTIONS}
          ariaLabel="Filter by date range"
          onChange={(v) => {
            if (v === "custom") {
              setCustomOpen(true);
              return;
            }
            setCustomOpen(false);
            go({ range: v === "all" ? "" : v, from: "", to: "" });
          }}
        />
        <Select
          value={status}
          options={STATUS_OPTIONS}
          ariaLabel="Filter by status"
          onChange={(v) => go({ status: v })}
        />
        <Select
          value={type}
          options={TYPE_OPTIONS}
          ariaLabel="Filter by check type"
          onChange={(v) => go({ type: v })}
        />
        {filtered && (
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setCustomOpen(false);
              go({ q: "", status: "all", type: "all", range: "", from: "", to: "" });
            }}
            className="text-sm text-ink/60 underline hover:text-ink"
          >
            Clear
          </button>
        )}
      </div>

      {customOpen && (
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="checks-from">From</label>
          <input
            id="checks-from"
            type="date"
            value={fromDraft}
            onChange={(e) => setFromDraft(e.target.value)}
            className={fieldClass}
          />
          <span className="text-sm text-ink/50">to</span>
          <label className="sr-only" htmlFor="checks-to">To</label>
          <input
            id="checks-to"
            type="date"
            value={toDraft}
            onChange={(e) => setToDraft(e.target.value)}
            className={fieldClass}
          />
          <button
            type="button"
            disabled={!fromDraft || !toDraft}
            onClick={() => go({ from: fromDraft, to: toDraft, range: "" })}
            className="rounded bg-ink px-3 py-2 text-sm font-semibold text-paper disabled:opacity-50"
          >
            Apply
          </button>
        </div>
      )}
    </div>
  );
}
