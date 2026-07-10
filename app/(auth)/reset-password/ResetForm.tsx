"use client";

import { useActionState } from "react";
import { requestPasswordReset, type AuthFormState } from "@/app/actions/auth";
import { FormMessage } from "@/app/components/FormMessage";
import { inputClass, labelClass, primaryButtonClass } from "@/app/components/ui";

const initial: AuthFormState = { status: "idle", message: "" };

export function ResetForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, initial);

  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="email" className={labelClass}>
          Work email
        </label>
        <input id="email" name="email" type="email" required autoComplete="email" className={inputClass} />
      </div>
      <button type="submit" disabled={pending} className={primaryButtonClass}>
        {pending ? "Sending…" : "Send reset link"}
      </button>
      <FormMessage state={state} />
    </form>
  );
}
