"use client";

import { useRouter } from "next/navigation";
import { Select } from "@/app/components/Select";
import { track } from "@/lib/analytics";

const OPTIONS = [
  ["10", "10 rows"],
  ["25", "25 rows"],
  ["50", "50 rows"],
  ["100", "100 rows"],
] as const;

/** Rows-per-page, remembered per user via cookie. */
export function PageSizeSelect({ value, baseHref }: { value: number; baseHref: string }) {
  const router = useRouter();
  return (
    <span className="flex items-center gap-2 text-sm text-ink/70">
      Rows per page
      <Select
        value={String(value)}
        options={OPTIONS}
        ariaLabel="Rows per page"
        onChange={(v) => {
          document.cookie = `br_rows=${v}; path=/; max-age=31536000; samesite=lax`;
          track("table_page_size_changed", { rows: Number(v) });
          const url = new URL(baseHref, window.location.origin);
          url.searchParams.delete("page");
          router.push(url.pathname + url.search);
        }}
      />
    </span>
  );
}
