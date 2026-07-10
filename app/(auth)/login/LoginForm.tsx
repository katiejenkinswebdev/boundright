"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { signIn, sendMagicLink, type AuthFormState } from "@/app/actions/auth";
import { FormMessage } from "@/app/components/FormMessage";
import {
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/app/components/ui";

const initial: AuthFormState = { status: "idle", message: "" };

export function LoginForm({ next }: { next: string }) {
  const [mode, setMode] = useState<"password" | "magic">("password");
  const [signInState, signInAction, signInPending] = useActionState(signIn, initial);
  const [magicState, magicAction, magicPending] = useActionState(sendMagicLink, initial);

  if (mode === "magic") {
    return (
      <form action={magicAction} className="space-y-4">
        <div>
          <label htmlFor="email" className={labelClass}>
            Work email
          </label>
          <input id="email" name="email" type="email" required autoComplete="email" className={inputClass} />
        </div>
        <button type="submit" disabled={magicPending} className={primaryButtonClass}>
          {magicPending ? "Sending…" : "Email me a sign-in link"}
        </button>
        <FormMessage state={magicState} />
        <button type="button" onClick={() => setMode("password")} className="text-sm underline">
          Sign in with a password instead
        </button>
      </form>
    );
  }

  return (
    <form action={signInAction} className="space-y-4">
      <input type="hidden" name="next" value={next} />
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
        <input id="password" name="password" type="password" required autoComplete="current-password" className={inputClass} />
      </div>
      <button type="submit" disabled={signInPending} className={primaryButtonClass}>
        {signInPending ? "Signing in…" : "Sign in"}
      </button>
      <FormMessage state={signInState} />
      <button type="button" onClick={() => setMode("magic")} className={secondaryButtonClass}>
        Email me a sign-in link instead
      </button>
      <p className="text-sm">
        <Link href="/reset-password" className="underline">
          Forgot your password?
        </Link>
      </p>
    </form>
  );
}
