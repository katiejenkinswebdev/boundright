"use client";

import { useActionState } from "react";
import { PasswordInput } from "@/app/components/PasswordInput";
import { completePasswordChange, type AuthFormState } from "@/app/actions/auth";

const initial: AuthFormState = { status: "idle", message: "" };

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState(completePasswordChange, initial);
  return (
    <form action={action} className="mt-6 space-y-3">
      <label className="block">
        <span className="mb-1 block text-sm font-semibold">New password</span>
        <PasswordInput
          name="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="w-full rounded border border-line bg-card px-3 py-2"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-semibold">Repeat it</span>
        <PasswordInput
          name="confirm"
          required
          minLength={8}
          autoComplete="new-password"
          className="w-full rounded border border-line bg-card px-3 py-2"
        />
      </label>
      <button
        disabled={pending}
        className="w-full rounded bg-ink px-5 py-2.5 font-semibold text-paper hover:bg-ink/90 disabled:opacity-50"
      >
        {pending ? "Saving…" : "Set password and continue"}
      </button>
      {state.message && (
        <p role="alert" className="text-sm text-flag">
          {state.message}
        </p>
      )}
    </form>
  );
}
