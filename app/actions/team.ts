"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile, requireUser } from "@/lib/auth";
import { isAdmin, canManageUsers, roleRank } from "@/lib/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailHtml, sendEmail } from "@/lib/email";

export type TeamState = { status: "idle" | "ok" | "error"; message: string };
const ok = (m: string): TeamState => ({ status: "ok", message: m });
const fail = (m: string): TeamState => ({ status: "error", message: m });

/** Admin invites a teammate; emails a join link (also returned for copy). */
export async function inviteMember(
  _prev: TeamState,
  formData: FormData
): Promise<TeamState> {
  const { profile, agency } = await requireProfile();
  if (!isAdmin(profile)) return fail("Only admins can invite teammates.");

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "user");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail("Enter a valid email.");
  if (!["admin", "manager", "user"].includes(role)) return fail("Pick a role.");

  const admin = createAdminClient();
  if (!admin) return fail("Server not configured.");

  const token = randomBytes(18).toString("hex");
  const { error } = await admin.from("invites").insert({
    agency_id: agency.id,
    email,
    role,
    token,
    invited_by: profile.user_id,
  });
  if (error) return fail("Couldn't create the invite. Try again.");

  const url = `${process.env.APP_URL ?? "http://localhost:3000"}/join/${token}`;
  await sendEmail(
    email,
    `You're invited to ${agency.name} on BoundRight`,
    emailHtml({
      heading: `Join ${agency.name} on BoundRight`,
      bodyHtml: `<p style="margin:0;">${profile.full_name} invited you to review policy checks as a ${role}. The link below signs you into the agency workspace.</p>`,
      cta: { label: "Accept the invite", url },
    })
  );

  revalidatePath("/settings");
  return ok(`Invite sent to ${email}. Link (also emailed): ${url}`);
}

export async function setMemberRole(
  _prev: TeamState,
  formData: FormData
): Promise<TeamState> {
  const { profile, agency } = await requireProfile();
  if (!isAdmin(profile)) return fail("Only admins can change roles.");
  const memberId = String(formData.get("member_id") ?? "");
  const role = String(formData.get("role") ?? "");
  if (!["admin", "manager", "user"].includes(role)) return fail("Pick a role.");
  if (memberId === profile.id && role !== "admin") {
    return fail("You can't remove your own admin role.");
  }
  const admin = createAdminClient();
  if (!admin) return fail("Server not configured.");
  const { error } = await admin
    .from("profiles")
    .update({ role })
    .eq("id", memberId)
    .eq("agency_id", agency.id);
  if (error) return fail("Couldn't update the role.");
  revalidatePath("/settings");
  return ok("Role updated.");
}

/** Invitee accepts: creates their profile in the inviting agency. */
export async function acceptInvite(token: string): Promise<string | null> {
  const { user } = await requireUser();
  const admin = createAdminClient();
  if (!admin) return "Server not configured.";

  const { data: invite } = await admin
    .from("invites")
    .select("*")
    .eq("token", token)
    .is("accepted_at", null)
    .maybeSingle();
  if (!invite) return "This invite link is invalid or was already used.";
  if (user.email?.toLowerCase() !== invite.email) {
    return `This invite was sent to ${invite.email}. Sign in with that email to accept it.`;
  }
  const { data: existing } = await admin
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (existing) return "This account already belongs to an agency.";

  const fullName =
    (user.user_metadata?.full_name as string | undefined) ?? user.email ?? "Teammate";
  const { error } = await admin.from("profiles").insert({
    user_id: user.id,
    agency_id: invite.agency_id,
    full_name: fullName,
    role: invite.role,
  });
  if (error) return "Couldn't join the agency. Try again.";
  await admin
    .from("invites")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", invite.id);
  redirect("/dashboard");
}

/**
 * Shared gate for member management: caller must be manager+, the target
 * must be in the same agency, must not be the caller, and must hold a
 * strictly lower role rank (managers manage users; admins manage managers
 * and users; the operator manages everyone).
 */
type ManageCtx =
  | { error: TeamState }
  | {
      admin: NonNullable<ReturnType<typeof createAdminClient>>;
      agency: { id: string };
      profile: { id: string; user_id: string; role: string };
      target: { id: string; user_id: string; full_name: string; role: string; suspended_at: string | null };
    };

async function manageableTarget(memberId: string): Promise<ManageCtx> {
  const { profile, agency } = await requireProfile();
  if (!canManageUsers(profile)) {
    return { error: fail("Only managers and admins can manage teammates.") };
  }
  const admin = createAdminClient();
  if (!admin) return { error: fail("Server not configured.") };
  const { data: target } = await admin
    .from("profiles")
    .select("id, user_id, full_name, role, suspended_at")
    .eq("id", memberId)
    .eq("agency_id", agency.id)
    .maybeSingle();
  if (!target) return { error: fail("Teammate not found.") };
  if (target.id === profile.id) {
    return { error: fail("You can't manage your own account here; use Profile.") };
  }
  if (roleRank(target.role) >= roleRank(profile.role)) {
    return { error: fail(`Your role can't manage a ${target.role.replace("_", " ")}.`) };
  }
  return { admin, agency, profile, target };
}

const logMember = (
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  agencyId: string,
  actorId: string,
  event: string,
  metadata: Record<string, unknown>
) => admin.from("events").insert({ agency_id: agencyId, user_id: actorId, event_name: event, metadata });

/** Manager+: update a teammate's display name and/or login email. */
export async function updateMemberProfile(
  _prev: TeamState,
  formData: FormData
): Promise<TeamState> {
  const ctx = await manageableTarget(String(formData.get("member_id") ?? ""));
  if ("error" in ctx) return ctx.error;
  const { admin, agency, profile, target } = ctx;

  const fullName = String(formData.get("full_name") ?? "").trim().slice(0, 120);
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const changes: string[] = [];

  if (fullName && fullName !== target.full_name) {
    const { error } = await admin.from("profiles").update({ full_name: fullName }).eq("id", target.id);
    if (error) return fail("Couldn't update the name.");
    changes.push("name");
  }
  if (email) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail("Enter a valid email.");
    const { error } = await admin.auth.admin.updateUserById(target.user_id, {
      email,
      email_confirm: true,
    });
    if (error) return fail(`Couldn't change the email: ${error.message}`);
    changes.push("email");
  }
  if (changes.length === 0) return fail("Nothing to update.");
  await logMember(admin, agency.id, profile.user_id, "member_updated", {
    member: target.id,
    changes,
  });
  revalidatePath("/settings");
  return ok(`Updated ${changes.join(" and ")} for ${fullName || target.full_name}.`);
}

/** Manager+: email a teammate a password reset link. */
export async function sendMemberPasswordReset(
  _prev: TeamState,
  formData: FormData
): Promise<TeamState> {
  const ctx = await manageableTarget(String(formData.get("member_id") ?? ""));
  if ("error" in ctx) return ctx.error;
  const { admin, agency, profile, target } = ctx;
  const { data: authUser } = await admin.auth.admin.getUserById(target.user_id);
  const email = authUser?.user?.email;
  if (!email) return fail("No login email on file for this teammate.");
  const { error } = await admin.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.APP_URL ?? "http://localhost:3000"}/reset-password`,
  });
  if (error) return fail("Couldn't send the reset email. Try again.");
  await logMember(admin, agency.id, profile.user_id, "member_password_reset_sent", {
    member: target.id,
  });
  return ok(`Password reset sent to ${email}.`);
}

/** Manager+: suspend (sign-in blocked) or restore a teammate. */
export async function setMemberAccess(
  _prev: TeamState,
  formData: FormData
): Promise<TeamState> {
  const suspend = String(formData.get("suspend")) === "true";
  const ctx = await manageableTarget(String(formData.get("member_id") ?? ""));
  if ("error" in ctx) return ctx.error;
  const { admin, agency, profile, target } = ctx;
  const { error } = await admin.auth.admin.updateUserById(target.user_id, {
    ban_duration: suspend ? "87600h" : "none",
  });
  if (error) return fail("Couldn't change access. Try again.");
  await admin
    .from("profiles")
    .update({ suspended_at: suspend ? new Date().toISOString() : null })
    .eq("id", target.id);
  await logMember(admin, agency.id, profile.user_id, suspend ? "member_suspended" : "member_restored", {
    member: target.id,
  });
  revalidatePath("/settings");
  return ok(suspend
    ? `${target.full_name} can no longer sign in. Active sessions end within the hour.`
    : `${target.full_name} can sign in again.`);
}

/** Manager+: remove a teammate entirely (profile + login). Their review history stays attributed in the audit log. */
export async function removeMember(
  _prev: TeamState,
  formData: FormData
): Promise<TeamState> {
  const ctx = await manageableTarget(String(formData.get("member_id") ?? ""));
  if ("error" in ctx) return ctx.error;
  const { admin, agency, profile, target } = ctx;
  const { error: pErr } = await admin.from("profiles").delete().eq("id", target.id);
  if (pErr) return fail("Couldn't remove the teammate. Try again.");
  const { error: uErr } = await admin.auth.admin.deleteUser(target.user_id);
  if (uErr) return fail("Profile removed, but the login could not be deleted. Contact support.");
  await logMember(admin, agency.id, profile.user_id, "member_removed", {
    member: target.id,
    name: target.full_name,
    role: target.role,
  });
  revalidatePath("/settings");
  return ok(`${target.full_name} was removed from the agency.`);
}

/** Admin: revoke a pending invite. */
export async function revokeInvite(
  _prev: TeamState,
  formData: FormData
): Promise<TeamState> {
  const { profile, agency } = await requireProfile();
  if (!isAdmin(profile)) return fail("Only admins can revoke invites.");
  const admin = createAdminClient();
  if (!admin) return fail("Server not configured.");
  const { error } = await admin
    .from("invites")
    .delete()
    .eq("id", String(formData.get("invite_id") ?? ""))
    .eq("agency_id", agency.id)
    .is("accepted_at", null);
  if (error) return fail("Couldn't revoke the invite.");
  revalidatePath("/settings");
  return ok("Invite revoked.");
}
