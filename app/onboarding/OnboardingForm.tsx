"use client";

import { useActionState } from "react";
import { completeOnboarding, type OnboardingState } from "@/app/actions/onboarding";
import { inputClass, labelClass, primaryButtonClass } from "@/app/components/ui";

const initial: OnboardingState = { status: "idle", message: "" };

export function OnboardingForm() {
  const [state, action, pending] = useActionState(completeOnboarding, initial);

  return (
    <form action={action} className="space-y-5">
      <div>
        <label htmlFor="agency_name" className={labelClass}>
          Agency name
        </label>
        <input
          id="agency_name"
          name="agency_name"
          type="text"
          required
          placeholder="e.g. Hartwell Insurance Group"
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="manual_check_minutes" className={labelClass}>
          How long does a manual policy check take you today?
        </label>
        <div className="flex items-center gap-2">
          <input
            id="manual_check_minutes"
            name="manual_check_minutes"
            type="number"
            min={1}
            defaultValue={45}
            className={inputClass}
          />
          <span className="text-ink/60">minutes</span>
        </div>
      </div>

      <div>
        <label htmlFor="avg_account_premium" className={labelClass}>
          Average account premium
        </label>
        <div className="flex items-center gap-2">
          <span className="text-ink/60">$</span>
          <input
            id="avg_account_premium"
            name="avg_account_premium"
            type="number"
            min={1}
            defaultValue={25000}
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label htmlFor="csr_hourly_rate" className={labelClass}>
          Loaded CSR hourly rate
        </label>
        <div className="flex items-center gap-2">
          <span className="text-ink/60">$</span>
          <input
            id="csr_hourly_rate"
            name="csr_hourly_rate"
            type="number"
            min={1}
            defaultValue={35}
            className={inputClass}
          />
        </div>
      </div>

      <p className="text-sm text-ink/60">
        These power your ROI dashboard. Change them anytime in Settings.
      </p>

      <button type="submit" disabled={pending} className={primaryButtonClass}>
        {pending ? "Setting up…" : "Finish setup"}
      </button>
      {state.status === "error" && (
        <p role="alert" className="text-flag text-sm">
          {state.message}
        </p>
      )}
    </form>
  );
}
