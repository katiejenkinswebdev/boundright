"use client";

import { useRouter } from "next/navigation";

/** Rows-per-page, remembered per user via cookie. */
export function PageSizeSelect({ value, baseHref }: { value: number; baseHref: string }) {
  const router = useRouter();
  return (
    <label className="flex items-center gap-2 text-sm text-ink/70">
      Rows per page
      <select
        value={value}
        onChange={(e) => {
          document.cookie = `br_rows=${e.target.value}; path=/; max-age=31536000; samesite=lax`;
          const url = new URL(baseHref, window.location.origin);
          url.searchParams.delete("page");
          router.push(url.pathname + url.search);
        }}
        className="rounded border border-line bg-card px-2 py-1 text-sm"
      >
        {[10, 25, 50, 100].map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
    </label>
  );
}
