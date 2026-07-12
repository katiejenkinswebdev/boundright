"use client";

import { useEffect, useState } from "react";
import { NewClientForm } from "./NewClientForm";

/** Space-saver: the client setup wizard lives behind a button, in a modal. */
export function NewClientModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", esc);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", esc);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded bg-ink px-4 py-2 text-sm font-semibold text-paper hover:bg-ink/90"
      >
        New client
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 p-4 sm:p-8"
          onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="New client setup"
        >
          <div className="w-full max-w-2xl rounded-lg border border-line bg-card p-6 shadow-md">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">New client setup</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="rounded border border-line px-2.5 py-1 text-sm hover:border-ink"
              >
                ✕
              </button>
            </div>
            <p className="mb-4 text-sm text-ink/70">
              One submit creates the agency, the client admin, and every
              roster account. Everyone signs in with their default password
              and must change it immediately.
            </p>
            <NewClientForm />
          </div>
        </div>
      )}
    </>
  );
}
