"use client";

import { useState, useActionState } from "react";
import { updateAgencySettings, type NewClientState } from "@/app/actions/admin";
import { PLANS } from "@/lib/pricing";

const initial: NewClientState = { status: "idle", message: "" };
const fieldClass = "w-full rounded border border-line bg-paper px-3 py-2 text-sm";

export type AgencySettings = {
  id: string;
  name: string;
  plan: string;
  checks_allowance: number | null;
  smart_intake_enabled: boolean;
  notify_webhook_url: string | null;
  manual_check_minutes: number;
  avg_account_premium: number;
  csr_hourly_rate: number;
  premium_variance_threshold: number;
  renewal_premium_threshold: number;
  reminder_hours: number;
};

/** Every operator-adjustable client setting, one form, one save. */
export function AgencySettingsForm({ agency }: { agency: AgencySettings }) {
  const [state, action, pending] = useActionState(
    updateAgencySettings.bind(null, agency.id),
    initial
  );
  const [plan, setPlan] = useState(agency.plan);
  const [smartIntake, setSmartIntake] = useState(agency.smart_intake_enabled);
  const premier = plan === "premium";

  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <label className="block">
        <span className="mb-1 block text-sm font-semibold">Agency name</span>
        <input name="name" defaultValue={agency.name} required className={fieldClass} />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-semibold">Plan</span>
        <select name="plan" value={plan} onChange={(e) => setPlan(e.target.value)} className={fieldClass}>
          {Object.entries(PLANS).map(([key, p]) => (
            <option key={key} value={key}>
              {p.name} · {p.checksPerMonth} checks/mo
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-semibold">Custom allowance (blank = plan default)</span>
        <input
          name="allowance"
          type="number"
          min={1}
          max={10000}
          defaultValue={agency.checks_allowance ?? ""}
          className={fieldClass}
        />
      </label>
      <label className="flex items-center gap-2 self-end pb-2 text-sm">
        <input
          type="checkbox"
          name="smart_intake"
          checked={premier || smartIntake}
          disabled={premier}
          onChange={(e) => setSmartIntake(e.target.checked)}
        />
        Smart intake{premier && <span className="text-ink/50">(included with Premier)</span>}
      </label>
      <label className="block sm:col-span-2">
        <span className="mb-1 block text-sm font-semibold">Slack/Teams webhook URL</span>
        <input
          name="webhook"
          type="url"
          defaultValue={agency.notify_webhook_url ?? ""}
          placeholder="https://hooks.slack.com/services/…"
          className={fieldClass}
        />
      </label>

      {(
        [
          ["manual_check_minutes", "Manual check minutes", agency.manual_check_minutes],
          ["avg_account_premium", "Avg account premium ($)", agency.avg_account_premium],
          ["csr_hourly_rate", "CSR hourly rate ($)", agency.csr_hourly_rate],
          ["premium_variance_threshold", "Premium variance %", agency.premium_variance_threshold],
          ["renewal_premium_threshold", "Renewal variance %", agency.renewal_premium_threshold],
          ["reminder_hours", "Review reminder hours", agency.reminder_hours],
        ] as const
      ).map(([name, label, value]) => (
        <label key={name} className="block">
          <span className="mb-1 block text-sm font-semibold">{label}</span>
          <input name={name} type="number" step="any" defaultValue={value} className={fieldClass} />
        </label>
      ))}

      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-ink px-5 py-2.5 text-sm font-semibold text-paper hover:bg-ink/90 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save client settings"}
        </button>
      </div>
      {state.message && (
        <p
          role={state.status === "error" ? "alert" : "status"}
          className={`text-sm sm:col-span-2 ${state.status === "error" ? "text-flag" : "text-verify"}`}
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
