"use client";

import { useState, useActionState } from "react";
import { PasswordInput } from "@/app/components/PasswordInput";
import { createClientAgency, type NewClientState } from "@/app/actions/admin";
import { PLANS } from "@/lib/pricing";

const initial: NewClientState = { status: "idle", message: "" };
const fieldClass = "w-full rounded border border-line bg-paper px-3 py-2 text-sm";

/**
 * The whole client setup in one submit: agency details, the client admin,
 * and a bulk user roster with default passwords (everyone must change
 * theirs at first sign-in). Premier auto-checks smart intake.
 */
export function NewClientForm() {
  const [state, action, pending] = useActionState(createClientAgency, initial);
  const [plan, setPlan] = useState("trial");
  const [smartIntake, setSmartIntake] = useState(false);
  const premier = plan === "premium";

  return (
    <form action={action} className="space-y-5">
      <div>
        <p className="mb-2 font-mono text-xs uppercase tracking-wide text-ink/50">1 · Agency</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Agency name</span>
            <input name="name" required placeholder="Lakeside Insurance Group" className={fieldClass} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Plan</span>
            <select
              name="plan"
              value={plan}
              onChange={(e) => setPlan(e.target.value)}
              className={fieldClass}
            >
              {Object.entries(PLANS).map(([key, p]) => (
                <option key={key} value={key}>
                  {p.name} · {p.checksPerMonth} checks/mo
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Custom allowance (optional)</span>
            <input name="allowance" type="number" min={1} max={10000} placeholder="plan default" className={fieldClass} />
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
        </div>
      </div>

      <div>
        <p className="mb-2 font-mono text-xs uppercase tracking-wide text-ink/50">2 · Client admin</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">First name</span>
            <input name="admin_first" required className={fieldClass} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Last name</span>
            <input name="admin_last" required className={fieldClass} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Email</span>
            <input name="admin_email" type="email" required className={fieldClass} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Default password</span>
            <PasswordInput name="admin_password" required minLength={8} placeholder="They change it at first sign-in" className={fieldClass} />
          </label>
        </div>
      </div>

      <div>
        <p className="mb-2 font-mono text-xs uppercase tracking-wide text-ink/50">
          3 · Team roster (optional, bulk)
        </p>
        <label className="block">
          <span className="mb-1 block text-sm text-ink/70">
            One user per line: <span className="font-mono text-xs">First, Last, Email, Role, DefaultPassword</span>{" "}
            (role: user, manager, or admin). Paste straight from a spreadsheet.
          </span>
          <textarea
            name="users"
            rows={5}
            placeholder={"Jordan, Rivera, jordan@lakesideins.com, user, Lakeside-2026!\nSam, Chen, sam@lakesideins.com, manager, Lakeside-2026!"}
            className={`${fieldClass} font-mono text-xs leading-relaxed`}
          />
        </label>
        <p className="mt-1 text-xs text-ink/50">
          Every account is created active and must set a new password the
          first time they sign in.
        </p>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="rounded bg-ink px-5 py-2.5 text-sm font-semibold text-paper hover:bg-ink/90 disabled:opacity-50"
      >
        {pending ? "Setting up…" : "Create client and all accounts"}
      </button>
      {state.message && (
        <p
          role={state.status === "error" ? "alert" : "status"}
          className={`break-words text-sm ${state.status === "error" ? "text-flag" : "text-verify"}`}
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
