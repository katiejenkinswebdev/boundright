"use client";

import { useActionState } from "react";
import { verifyMfaLogin, type MfaState } from "@/app/actions/mfa";
import { signOut } from "@/app/actions/auth";

const initial: MfaState = { status: "idle", message: "" };

export function MfaLoginForm() {
  const [state, action, pending] = useActionState(verifyMfaLogin, initial);
  return (
    <div className="mt-6 space-y-4">
      <form action={action} className="flex items-center gap-2">
        <input
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          required
          autoFocus
          placeholder="123456"
          className="w-32 rounded border border-line bg-card px-3 py-2 text-center font-mono tracking-widest"
          aria-label="6-digit code"
        />
        <button
          disabled={pending}
          className="rounded bg-ink px-5 py-2 font-semibold text-paper hover:bg-ink/90 disabled:opacity-50"
        >
          {pending ? "Checking…" : "Verify"}
        </button>
      </form>
      {state.message && (
        <p role="alert" className="text-sm text-flag">
          {state.message}
        </p>
      )}
      <form action={signOut}>
        <button type="submit" className="text-sm text-ink/60 underline">
          Sign out and start over
        </button>
      </form>
    </div>
  );
}
