"use client";

import { useState, useTransition, useActionState } from "react";
import {
  enrollMfa,
  verifyMfaEnrollment,
  unenrollMfa,
  type MfaState,
} from "@/app/actions/mfa";
import { track } from "@/lib/analytics";

const initial: MfaState = { status: "idle", message: "" };

function Msg({ state }: { state: MfaState }) {
  if (!state.message) return null;
  return (
    <p
      role={state.status === "error" ? "alert" : "status"}
      className={`text-sm ${state.status === "error" ? "text-flag" : "text-verify"}`}
    >
      {state.message}
    </p>
  );
}

/**
 * Two-factor authentication with an authenticator app (TOTP). Enroll shows
 * a QR code + manual secret; a 6-digit code confirms. Once on, sign-in
 * always asks for a code.
 */
export function MfaSection({ enrolledFactorId }: { enrolledFactorId: string | null }) {
  const [enrollment, setEnrollment] = useState<{
    factorId: string;
    qrCode: string;
    secret: string;
  } | null>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const [verifyState, verifyAction, verifyPending] = useActionState(
    async (prev: MfaState, fd: FormData) => {
      const result = await verifyMfaEnrollment(prev, fd);
      if (result.status === "ok") track("mfa_enrolled");
      return result;
    },
    initial
  );
  const [offState, offAction, offPending] = useActionState(
    async (prev: MfaState, fd: FormData) => {
      const result = await unenrollMfa(prev, fd);
      if (result.status === "ok") track("mfa_disabled");
      return result;
    },
    initial
  );

  if (enrolledFactorId && verifyState.status !== "ok") {
    return (
      <div className="space-y-3">
        <p className="text-sm">
          <span className="inline-flex items-center rounded border border-verify px-2.5 py-1 font-mono text-xs uppercase leading-none text-verify">
            on
          </span>
          <span className="ml-2 text-ink/70">
            Sign-in asks for a code from your authenticator app.
          </span>
        </p>
        <form action={offAction}>
          <input type="hidden" name="factor_id" value={enrolledFactorId} />
          <button
            disabled={offPending}
            className="text-sm text-flag underline disabled:opacity-50"
          >
            {offPending ? "Turning off…" : "Turn off two-factor authentication"}
          </button>
        </form>
        <Msg state={offState} />
      </div>
    );
  }

  if (verifyState.status === "ok") {
    return <Msg state={verifyState} />;
  }

  if (!enrollment) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-ink/70">
          Add a second lock on your account: after your password, sign-in asks
          for a 6-digit code from an authenticator app (Google Authenticator,
          1Password, Authy). Strongly recommended for admins.
        </p>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setError("");
            startTransition(async () => {
              const result = await enrollMfa();
              if (result.ok) setEnrollment(result);
              else setError(result.message);
            });
          }}
          className="rounded border border-ink px-4 py-2 text-sm font-semibold hover:bg-ink hover:text-paper disabled:opacity-50"
        >
          {pending ? "Preparing…" : "Set up two-factor authentication"}
        </button>
        {error && <p className="text-sm text-flag">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ol className="list-decimal space-y-2 pl-5 text-sm text-ink/80">
        <li>Open your authenticator app and scan this QR code.</li>
        <li>Enter the 6-digit code the app shows to confirm.</li>
      </ol>
      {/* Supabase returns the QR as an inline SVG data URI. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={enrollment.qrCode}
        alt="Scan this QR code with your authenticator app"
        className="h-40 w-40 rounded border border-line bg-white p-2"
      />
      <p className="font-mono text-xs text-ink/60">
        Can&apos;t scan? Enter this key manually: {enrollment.secret}
      </p>
      <form action={verifyAction} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="factor_id" value={enrollment.factorId} />
        <input
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          required
          placeholder="123456"
          className="w-28 rounded border border-line bg-paper px-3 py-2 text-center font-mono text-sm tracking-widest"
          aria-label="6-digit code"
        />
        <button
          disabled={verifyPending}
          className="rounded bg-ink px-4 py-2 text-sm font-semibold text-paper hover:bg-ink/90 disabled:opacity-50"
        >
          {verifyPending ? "Confirming…" : "Confirm"}
        </button>
      </form>
      <Msg state={verifyState} />
    </div>
  );
}
