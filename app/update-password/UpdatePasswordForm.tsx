"use client";

import { useActionState } from "react";
import { PasswordInput } from "@/app/components/PasswordInput";
import { updatePassword, type AuthFormState } from "@/app/actions/auth";
import { FormMessage } from "@/app/components/FormMessage";
import { inputClass, labelClass, primaryButtonClass } from "@/app/components/ui";

const initial: AuthFormState = { status: "idle", message: "" };

export function UpdatePasswordForm() {
  const [state, action, pending] = useActionState(updatePassword, initial);

  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="password" className={labelClass}>
          New password
        </label>
        <PasswordInput
          id="password"
          name="password"
          required
          minLength={8}
          autoComplete="new-password"
          className={inputClass}
        />
        <p className="mt-1 text-sm text-ink/60">At least 8 characters.</p>
      </div>
      <button type="submit" disabled={pending} className={primaryButtonClass}>
        {pending ? "Saving…" : "Save new password"}
      </button>
      <FormMessage state={state} />
    </form>
  );
}
