"use client";

import { useActionState } from "react";
import { createClientAgency, type NewClientState } from "@/app/actions/admin";
import { PLANS } from "@/lib/pricing";

const initial: NewClientState = { status: "idle", message: "" };

/** One-step client setup: agency + plan + allowance + admin invite. */
export function NewClientForm() {
  const [state, action, pending] = useActionState(createClientAgency, initial);

  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <label className="block">
        <span className="mb-1 block text-sm font-semibold">Agency name</span>
        <input
          name="name"
          required
          placeholder="Lakeside Insurance Group"
          className="w-full rounded border border-line bg-paper px-3 py-2 text-sm"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-semibold">Client admin email</span>
        <input
          name="admin_email"
          type="email"
          required
          placeholder="principal@lakesideins.com"
          className="w-full rounded border border-line bg-paper px-3 py-2 text-sm"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-semibold">Plan</span>
        <select
          name="plan"
          defaultValue="trial"
          className="w-full rounded border border-line bg-paper px-3 py-2 text-sm"
        >
          {Object.entries(PLANS).map(([key, plan]) => (
            <option key={key} value={key}>
              {plan.name} · {plan.checksPerMonth} checks/mo
            </option>
          ))}
        </select>
      </label>
      <div className="flex items-end gap-4">
        <label className="block flex-1">
          <span className="mb-1 block text-sm font-semibold">Custom allowance</span>
          <input
            name="allowance"
            type="number"
            min={1}
            max={10000}
            placeholder="plan default"
            className="w-full rounded border border-line bg-paper px-3 py-2 text-sm"
          />
        </label>
        <label className="flex items-center gap-2 pb-2 text-sm">
          <input type="checkbox" name="smart_intake" />
          Smart intake
        </label>
      </div>
      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-ink px-4 py-2 text-sm font-semibold text-paper hover:bg-ink/90 disabled:opacity-50"
        >
          {pending ? "Setting up…" : "Create client and send invite"}
        </button>
      </div>
      {state.message && (
        <p
          role={state.status === "error" ? "alert" : "status"}
          className={`break-all text-sm sm:col-span-2 ${state.status === "error" ? "text-flag" : "text-verify"}`}
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
