"use client";

import { useState } from "react";

/** Password field with a show/hide toggle. Accepts any input props. */
export function PasswordInput({
  className,
  ...props
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [visible, setVisible] = useState(false);
  return (
    <span className="relative block">
      <input
        {...props}
        type={visible ? "text" : "password"}
        className={`${className ?? ""} pr-10`}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-ink/50 hover:text-ink"
      >
        {visible ? (
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M2.5 10s2.8-5 7.5-5c1 0 1.9.2 2.7.6M17.5 10s-2.8 5-7.5 5c-1 0-1.9-.2-2.7-.6" />
            <circle cx="10" cy="10" r="2.5" />
            <path d="M3.5 16.5 16.5 3.5" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M2.5 10s2.8-5 7.5-5 7.5 5 7.5 5-2.8 5-7.5 5-7.5-5-7.5-5z" />
            <circle cx="10" cy="10" r="2.5" />
          </svg>
        )}
      </button>
    </span>
  );
}
