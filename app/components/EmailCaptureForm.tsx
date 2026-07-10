"use client";

import { useActionState } from "react";
import { captureEmail, type EmailCaptureState } from "@/app/actions/email-capture";

const initialState: EmailCaptureState = { status: "idle", message: "" };

export function EmailCaptureForm() {
  const [state, formAction, pending] = useActionState(captureEmail, initialState);

  if (state.status === "ok") {
    return (
      <p role="status" className="text-verify font-medium">
        {state.message}
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col sm:flex-row gap-3 max-w-md">
      <label htmlFor="email" className="sr-only">
        Work email
      </label>
      <input
        id="email"
        name="email"
        type="email"
        required
        autoComplete="email"
        placeholder="you@youragency.com"
        className="flex-1 rounded border border-line bg-card px-4 py-3 text-ink placeholder:text-ink/40"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-ink px-6 py-3 font-semibold text-paper hover:bg-ink/90 disabled:opacity-60"
      >
        {pending ? "Adding you…" : "Get launch updates"}
      </button>
      {state.status === "error" && (
        <p role="alert" className="text-flag text-sm sm:basis-full">
          {state.message}
        </p>
      )}
    </form>
  );
}
