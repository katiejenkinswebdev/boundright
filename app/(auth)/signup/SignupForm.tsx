"use client";

import { useActionState } from "react";
import { signUp, type AuthFormState } from "@/app/actions/auth";
import { FormMessage } from "@/app/components/FormMessage";
import { inputClass, labelClass, primaryButtonClass } from "@/app/components/ui";

const initial: AuthFormState = { status: "idle", message: "" };

export function SignupForm() {
  const [state, action, pending] = useActionState(signUp, initial);

  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="full_name" className={labelClass}>
          Your name
        </label>
        <input id="full_name" name="full_name" type="text" required autoComplete="name" className={inputClass} />
      </div>
      <div>
        <label htmlFor="email" className={labelClass}>
          Work email
        </label>
        <input id="email" name="email" type="email" required autoComplete="email" className={inputClass} />
      </div>
      <div>
        <label htmlFor="password" className={labelClass}>
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className={inputClass}
        />
        <p className="mt-1 text-sm text-ink/60">At least 8 characters.</p>
      </div>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="accept_terms" required className="mt-1" />
        <span>
          I agree to the Terms of Service. BoundRight is a review assistant. It
          does not provide insurance advice, and final determination of
          coverage accuracy is the responsibility of the licensed agent.
        </span>
      </label>
      <button type="submit" disabled={pending} className={primaryButtonClass}>
        {pending ? "Creating your account…" : "Start free trial"}
      </button>
      <FormMessage state={state} />
      <p className="text-sm text-ink/60">
        14 days, 10 checks, no credit card required.
      </p>
    </form>
  );
}
