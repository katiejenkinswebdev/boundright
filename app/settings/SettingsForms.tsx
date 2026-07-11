"use client";

import { useActionState } from "react";
import {
  updateProfile,
  updateAgency,
  uploadLogo,
  changePassword,
  deleteAccount,
  type SettingsState,
} from "@/app/actions/settings";
import { startCheckout, openBillingPortal, type BillingState } from "@/app/actions/billing";
import { inputClass, labelClass, primaryButtonClass, secondaryButtonClass } from "@/app/components/ui";

const initial: SettingsState = { status: "idle", message: "" };
const billingInitial: BillingState = { status: "idle", message: "" };

function Msg({ state }: { state: SettingsState | BillingState }) {
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

export function ProfileForm({ fullName, email }: { fullName: string; email: string }) {
  const [state, action, pending] = useActionState(updateProfile, initial);
  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="full_name" className={labelClass}>
          Your name (appears on reviewed reports)
        </label>
        <input id="full_name" name="full_name" defaultValue={fullName} required className={inputClass} />
      </div>
      <p className="text-sm text-ink/60">Signed in as {email}</p>
      <button disabled={pending} className={secondaryButtonClass}>
        {pending ? "Saving…" : "Save profile"}
      </button>
      <Msg state={state} />
    </form>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePassword, initial);
  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="password" className={labelClass}>
          New password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          minLength={8}
          required
          autoComplete="new-password"
          className={inputClass}
        />
      </div>
      <button disabled={pending} className={secondaryButtonClass}>
        {pending ? "Saving…" : "Change password"}
      </button>
      <Msg state={state} />
    </form>
  );
}

export function AgencyForm({
  name,
  minutes,
  premium,
  rate,
  varPct,
  renewalPct,
  reminderHours,
}: {
  name: string;
  minutes: number;
  premium: number;
  rate: number;
  varPct: number;
  renewalPct: number;
  reminderHours: number;
}) {
  const [state, action, pending] = useActionState(updateAgency, initial);
  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="agency_name" className={labelClass}>
          Agency name
        </label>
        <input id="agency_name" name="agency_name" defaultValue={name} required className={inputClass} />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="manual_check_minutes" className={labelClass}>
            Manual check time (min)
          </label>
          <input id="manual_check_minutes" name="manual_check_minutes" type="number" min={1} defaultValue={minutes} className={inputClass} />
        </div>
        <div>
          <label htmlFor="avg_account_premium" className={labelClass}>
            Avg account premium ($)
          </label>
          <input id="avg_account_premium" name="avg_account_premium" type="number" min={1} defaultValue={premium} className={inputClass} />
        </div>
        <div>
          <label htmlFor="csr_hourly_rate" className={labelClass}>
            CSR hourly rate ($)
          </label>
          <input id="csr_hourly_rate" name="csr_hourly_rate" type="number" min={1} defaultValue={rate} className={inputClass} />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="premium_variance_threshold" className={labelClass}>
            Premium variance threshold (%)
          </label>
          <input id="premium_variance_threshold" name="premium_variance_threshold" type="number" min={0.5} step={0.5} defaultValue={varPct} className={inputClass} />
        </div>
        <div>
          <label htmlFor="renewal_premium_threshold" className={labelClass}>
            Renewal premium threshold (%)
          </label>
          <input id="renewal_premium_threshold" name="renewal_premium_threshold" type="number" min={1} step={0.5} defaultValue={renewalPct} className={inputClass} />
        </div>
        <div>
          <label htmlFor="reminder_hours" className={labelClass}>
            Review reminder after (hours)
          </label>
          <input id="reminder_hours" name="reminder_hours" type="number" min={1} defaultValue={reminderHours} className={inputClass} />
        </div>
      </div>
      <p className="text-sm text-ink/60">
        These power your ROI dashboard and tune how checks are scored: premium
        differences above your thresholds get flagged as moderate instead of
        minor, and reminders go out when a report waits longer than you allow.
      </p>
      <button disabled={pending} className={secondaryButtonClass}>
        {pending ? "Saving…" : "Save agency settings"}
      </button>
      <Msg state={state} />
    </form>
  );
}

export function LogoForm({ logoUrl }: { logoUrl: string | null }) {
  const [state, action, pending] = useActionState(uploadLogo, initial);
  return (
    <form action={action} className="space-y-3">
      {logoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="Agency logo" className="h-12 w-auto rounded border border-line bg-white p-1" />
      )}
      <div>
        <label htmlFor="logo" className={labelClass}>
          Agency logo (PNG or JPEG, used on exported reports)
        </label>
        <input id="logo" name="logo" type="file" accept="image/png,image/jpeg" className="text-sm" />
      </div>
      <button disabled={pending} className={secondaryButtonClass}>
        {pending ? "Uploading…" : "Upload logo"}
      </button>
      <Msg state={state} />
    </form>
  );
}

export function BillingSection({
  plan,
  hasSubscription,
}: {
  plan: string;
  hasSubscription: boolean;
}) {
  const [checkoutState, checkoutAction, checkoutPending] = useActionState(startCheckout, billingInitial);
  const [portalState, portalAction, portalPending] = useActionState(openBillingPortal, billingInitial);

  return (
    <div className="space-y-4">
      <p className="text-sm">
        Current plan: <span className="font-mono font-semibold uppercase">{plan}</span>
      </p>
      {hasSubscription ? (
        <form action={portalAction} className="space-y-2">
          <button disabled={portalPending} className={secondaryButtonClass}>
            {portalPending ? "Opening…" : "Manage billing"}
          </button>
          <p className="text-sm text-ink/60">
            Update your card, download invoices, or cancel in one click. No
            retention hoops.
          </p>
          <Msg state={portalState} />
        </form>
      ) : (
        <form action={checkoutAction} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex cursor-pointer items-start gap-3 rounded border border-line p-4">
              <input type="radio" name="plan" value="founding" defaultChecked className="mt-1" />
              <span>
                <span className="font-semibold">Founding · $249/mo</span>
                <br />
                <span className="text-sm text-ink/60">150 checks/mo, founding price locked in</span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-3 rounded border border-line p-4">
              <input type="radio" name="plan" value="standard" className="mt-1" />
              <span>
                <span className="font-semibold">Standard · $349/mo</span>
                <br />
                <span className="text-sm text-ink/60">150 checks/mo</span>
              </span>
            </label>
          </div>
          <button disabled={checkoutPending} className={primaryButtonClass}>
            {checkoutPending ? "Redirecting…" : "Subscribe"}
          </button>
          <Msg state={checkoutState} />
        </form>
      )}
    </div>
  );
}

export function DangerZone({ agencyName }: { agencyName: string }) {
  const [state, action, pending] = useActionState(deleteAccount, initial);
  return (
    <form action={action} className="space-y-4">
      <p className="text-sm text-ink/80">
        Deleting your account removes your agency, every check, every finding,
        and every report. This cannot be undone. Type{" "}
        <span className="font-mono font-semibold">{agencyName}</span> to confirm.
      </p>
      <input
        name="confirm_name"
        placeholder="Type your agency name"
        className={inputClass}
        autoComplete="off"
      />
      <button
        disabled={pending}
        className="rounded border border-flag px-6 py-3 font-semibold text-flag hover:bg-flag hover:text-white disabled:opacity-50"
      >
        {pending ? "Deleting…" : "Delete account and all data"}
      </button>
      <Msg state={state} />
    </form>
  );
}
