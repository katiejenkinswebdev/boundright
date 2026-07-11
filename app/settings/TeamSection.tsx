"use client";

import { useActionState } from "react";
import { inviteMember, setMemberRole, type TeamState } from "@/app/actions/team";
import { updateIntegrations, type SettingsState } from "@/app/actions/settings";
import { inputClass, labelClass, secondaryButtonClass } from "@/app/components/ui";

const initial: TeamState = { status: "idle", message: "" };
const settingsInitial: SettingsState = { status: "idle", message: "" };

function Msg({ state }: { state: TeamState | SettingsState }) {
  if (!state.message) return null;
  return (
    <p
      role={state.status === "error" ? "alert" : "status"}
      className={`break-all text-sm ${state.status === "error" ? "text-flag" : "text-verify"}`}
    >
      {state.message}
    </p>
  );
}

const ROLES = [
  ["user", "User · runs and reviews checks"],
  ["manager", "Manager · user features plus agency analytics"],
  ["admin", "Admin · everything, including billing and team"],
] as const;

export function TeamSection({
  members,
  selfId,
}: {
  members: { id: string; full_name: string; role: string }[];
  selfId: string;
}) {
  const [inviteState, inviteAction, invitePending] = useActionState(inviteMember, initial);
  const [roleState, roleAction] = useActionState(setMemberRole, initial);

  return (
    <div className="space-y-6">
      <ul className="divide-y divide-line/60">
        {members.map((m) => (
          <li key={m.id} className="flex items-center justify-between gap-3 py-2">
            <span className="font-medium">
              {m.full_name}
              {m.id === selfId && <span className="text-ink/50"> (you)</span>}
            </span>
            <form action={roleAction} className="flex items-center gap-2">
              <input type="hidden" name="member_id" value={m.id} />
              <select
                name="role"
                defaultValue={m.role}
                className="rounded border border-line bg-card px-2 py-1 text-sm"
                aria-label={`Role for ${m.full_name}`}
              >
                {ROLES.map(([value]) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
              <button type="submit" className="text-sm underline">
                Save
              </button>
            </form>
          </li>
        ))}
      </ul>
      <Msg state={roleState} />

      <form action={inviteAction} className="space-y-3 border-t border-line pt-4">
        <p className="font-semibold">Invite a teammate</p>
        <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
          <input
            name="email"
            type="email"
            required
            placeholder="teammate@youragency.com"
            className={inputClass}
            aria-label="Teammate email"
          />
          <select name="role" defaultValue="user" className={inputClass} aria-label="Role">
            {ROLES.map(([value]) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
        <p className="text-sm text-ink/60">
          {ROLES.map(([, blurb]) => blurb).join(". ")}.
        </p>
        <button disabled={invitePending} className={secondaryButtonClass}>
          {invitePending ? "Inviting…" : "Send invite"}
        </button>
        <Msg state={inviteState} />
      </form>
    </div>
  );
}

export function IntegrationsSection({
  webhookUrl,
  inboundToken,
}: {
  webhookUrl: string | null;
  inboundToken: string;
}) {
  const [state, action, pending] = useActionState(updateIntegrations, settingsInitial);
  return (
    <div className="space-y-6">
      <form action={action} className="space-y-3">
        <div>
          <label htmlFor="notify_webhook_url" className={labelClass}>
            Slack or Teams incoming webhook URL
          </label>
          <input
            id="notify_webhook_url"
            name="notify_webhook_url"
            type="url"
            defaultValue={webhookUrl ?? ""}
            placeholder="https://hooks.slack.com/services/…"
            className={inputClass}
          />
          <p className="mt-1 text-sm text-ink/60">
            Check-ready and review-reminder notices post here. Leave blank to
            turn it off.
          </p>
        </div>
        <button disabled={pending} className={secondaryButtonClass}>
          {pending ? "Saving…" : "Save webhook"}
        </button>
        <Msg state={state} />
      </form>

      <div className="border-t border-line pt-4">
        <p className={labelClass}>Email-in checks</p>
        <p className="font-mono text-sm break-all">checks+{inboundToken}@in.boundright.app</p>
        <p className="mt-1 text-sm text-ink/60">
          Forward a carrier email with the proposal and issued policy attached
          (2 PDFs) and the check starts itself. Treat this address like a
          password; email help@boundright.app to rotate it.
        </p>
      </div>
    </div>
  );
}
