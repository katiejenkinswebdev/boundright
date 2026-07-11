"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile, requireUser } from "@/lib/auth";
import { isAdmin } from "@/lib/roles";
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
