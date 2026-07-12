"use client";

import { useActionState } from "react";
import {
  inviteMember,
  setMemberRole,
  updateMemberProfile,
  sendMemberPasswordReset,
  setMemberAccess,
  removeMember,
  revokeInvite,
  type TeamState,
} from "@/app/actions/team";
import { updateIntegrations, sendTestNotice, type SettingsState } from "@/app/actions/settings";
import { inputClass, labelClass, secondaryButtonClass } from "@/app/components/ui";
import { InfoTip } from "@/app/components/InfoTip";

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

export type MemberRow = {
  id: string;
  full_name: string;
  role: string;
  email: string;
  lastSignIn: string | null;
  suspended: boolean;
  manageable: boolean;
};

function ManageMember({ member, viewerIsAdmin }: { member: MemberRow; viewerIsAdmin: boolean }) {
  const [roleState, roleAction] = useActionState(setMemberRole, initial);
  const [profileState, profileAction, profilePending] = useActionState(updateMemberProfile, initial);
  const [resetState, resetAction, resetPending] = useActionState(sendMemberPasswordReset, initial);
  const [accessState, accessAction, accessPending] = useActionState(setMemberAccess, initial);
  const [removeState, removeAction, removePending] = useActionState(removeMember, initial);

  return (
    <details className="mt-2 rounded border border-line bg-paper p-3">
      <summary className="cursor-pointer text-sm text-ink/70 hover:text-ink">Manage</summary>
      <div className="mt-3 space-y-4">
        <form action={profileAction} className="space-y-2">
          <input type="hidden" name="member_id" value={member.id} />
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block">
              <span className={labelClass}>Name</span>
              <input name="full_name" defaultValue={member.full_name} className={inputClass} />
            </label>
            <label className="block">
              <span className={labelClass}>Login email</span>
              <input name="email" type="email" defaultValue={member.email} className={inputClass} />
            </label>
          </div>
          <button disabled={profilePending} className="rounded border border-ink px-4 py-1.5 text-sm font-semibold hover:bg-ink hover:text-paper disabled:opacity-50">
            {profilePending ? "Saving…" : "Save changes"}
          </button>
          <Msg state={profileState} />
        </form>

        {viewerIsAdmin && (
          <form action={roleAction} className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
            <input type="hidden" name="member_id" value={member.id} />
            <label className="text-sm text-ink/70" htmlFor={`role-${member.id}`}>
              Role
            </label>
            <select
              id={`role-${member.id}`}
              name="role"
              defaultValue={member.role}
              className="rounded border border-line bg-card px-2 py-1 text-sm"
            >
              {ROLES.map(([value]) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
            <button type="submit" className="text-sm underline">
              Save role
            </button>
            <Msg state={roleState} />
          </form>
        )}

        <div className="flex flex-wrap items-center gap-3 border-t border-line pt-3">
          <form action={resetAction}>
            <input type="hidden" name="member_id" value={member.id} />
            <button disabled={resetPending} className="text-sm underline disabled:opacity-50">
              {resetPending ? "Sending…" : "Send password reset"}
            </button>
          </form>
          <form action={accessAction}>
            <input type="hidden" name="member_id" value={member.id} />
            <input type="hidden" name="suspend" value={member.suspended ? "false" : "true"} />
            <button
              disabled={accessPending}
              className={`text-sm underline disabled:opacity-50 ${member.suspended ? "text-verify" : "text-caution"}`}
            >
              {accessPending ? "Working…" : member.suspended ? "Restore access" : "Suspend access"}
            </button>
          </form>
          <form
            action={removeAction}
            onSubmit={(e) => {
              if (!confirm(`Remove ${member.full_name} from the agency? Their login is deleted; their review history stays in the audit log.`)) {
                e.preventDefault();
              }
            }}
          >
            <input type="hidden" name="member_id" value={member.id} />
            <button disabled={removePending} className="text-sm text-flag underline disabled:opacity-50">
              {removePending ? "Removing…" : "Remove from agency"}
            </button>
          </form>
        </div>
        <Msg state={resetState} />
        <Msg state={accessState} />
        <Msg state={removeState} />
      </div>
    </details>
  );
}

export function TeamSection({
  members,
  selfId,
  viewerIsAdmin,
  pendingInvites,
}: {
  members: MemberRow[];
  selfId: string;
  viewerIsAdmin: boolean;
  pendingInvites: { id: string; email: string; role: string; created_at: string }[];
}) {
  const [inviteState, inviteAction, invitePending] = useActionState(inviteMember, initial);
  const [revokeState, revokeAction] = useActionState(revokeInvite, initial);

  return (
    <div className="space-y-6">
      <ul className="divide-y divide-line/60">
        {members.map((m) => (
          <li key={m.id} className="py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="min-w-0">
                <span className="font-medium">
                  {m.full_name}
                  {m.id === selfId && <span className="text-ink/50"> (you)</span>}
                </span>
                {m.suspended && (
                  <span className="ml-2 inline-flex items-center rounded border border-caution px-2 py-0.5 font-mono text-xs uppercase leading-none text-caution">
                    suspended
                  </span>
                )}
                <span className="block truncate font-mono text-xs text-ink/60">
                  {m.email}
                  {m.lastSignIn
                    ? ` · last sign-in ${new Date(m.lastSignIn).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                    : " · never signed in"}
                </span>
              </span>
              <span className="font-mono text-xs uppercase text-ink/60">
                {m.role.replace("_", " ")}
              </span>
            </div>
            {m.manageable && <ManageMember member={m} viewerIsAdmin={viewerIsAdmin} />}
          </li>
        ))}
      </ul>

      {viewerIsAdmin && pendingInvites.length > 0 && (
        <div className="border-t border-line pt-4">
          <p className="mb-2 font-semibold">Pending invites</p>
          <ul className="space-y-1">
            {pendingInvites.map((inv) => (
              <li key={inv.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="font-mono text-xs">
                  {inv.email} · {inv.role} · sent{" "}
                  {new Date(inv.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
                <form action={revokeAction}>
                  <input type="hidden" name="invite_id" value={inv.id} />
                  <button type="submit" className="text-sm underline">
                    Revoke
                  </button>
                </form>
              </li>
            ))}
          </ul>
          <Msg state={revokeState} />
        </div>
      )}

      {viewerIsAdmin && (
      <form action={inviteAction} className="space-y-3 border-t border-line pt-4">
        <p className="font-semibold">Invite a teammate</p>
        <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
          <div>
            <label htmlFor="invite_email" className={labelClass}>
              Email
            </label>
            <input
              id="invite_email"
              name="email"
              type="email"
              required
              placeholder="teammate@youragency.com"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="invite_role" className={labelClass}>
              Role
              <InfoTip label="What each role can do">
                {ROLES.map(([value, blurb]) => (
                  <span key={value} className="mt-2 block first:mt-0">
                    <strong>{blurb.split(" · ")[0]}</strong> —{" "}
                    {blurb.split(" · ")[1]}.
                  </span>
                ))}
              </InfoTip>
            </label>
            <select id="invite_role" name="role" defaultValue="user" className={inputClass}>
              {ROLES.map(([value]) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
        </div>
        <button disabled={invitePending} className={secondaryButtonClass}>
          {invitePending ? "Inviting…" : "Send invite"}
        </button>
        <Msg state={inviteState} />
      </form>
      )}
    </div>
  );
}

export function IntegrationsSection({
  webhookUrl,
}: {
  webhookUrl: string | null;
}) {
  const [state, action, pending] = useActionState(updateIntegrations, settingsInitial);
  const [testState, testAction, testPending] = useActionState(sendTestNotice, settingsInitial);
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
        <div className="flex flex-wrap gap-3">
          <button disabled={pending} className={secondaryButtonClass + " w-auto"}>
            {pending ? "Saving…" : "Save webhook"}
          </button>
          <button
            formAction={testAction}
            disabled={testPending || !webhookUrl}
            className="rounded border border-line px-6 py-3 font-semibold text-ink/70 hover:border-ink disabled:opacity-50"
          >
            {testPending ? "Sending…" : "Send test notice"}
          </button>
        </div>
        <Msg state={state} />
        <Msg state={testState} />
      </form>

      <div className="border-t border-line pt-4">
        <p className={labelClass}>Email-in checks</p>
        <p className="text-sm text-ink/60">
          Coming soon: forward a carrier email with both PDFs attached and the
          check starts itself. Tell us via Send feedback if you&apos;d use it.
        </p>
      </div>
    </div>
  );
}
