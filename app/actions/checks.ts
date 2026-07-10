"use server";

import { after } from "next/server";
import { requireProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { runCheck, docPaths } from "@/lib/pipeline/run";

const POLICY_TYPES = ["GL", "Property", "WC", "Auto", "Umbrella", "Package", "Other"];
const TRIAL_CHECK_LIMIT = 10;
const PAID_CHECK_LIMIT = 150;

export type CreateCheckResult =
  | {
      ok: true;
      checkId: string;
      uploadA: { url: string; token: string };
      uploadB: { url: string; token: string };
    }
  | { ok: false; message: string };

export async function createCheck(formData: FormData): Promise<CreateCheckResult> {
  const { profile, agency } = await requireProfile();

  const label = String(formData.get("label") ?? "").trim();
  const policyType = String(formData.get("policy_type") ?? "");
  const docAName = String(formData.get("doc_a_filename") ?? "").slice(0, 255);
  const docBName = String(formData.get("doc_b_filename") ?? "").slice(0, 255);

  if (!label) return { ok: false, message: "Give this check a client or account name." };
  if (!POLICY_TYPES.includes(policyType)) {
    return { ok: false, message: "Pick a policy type." };
  }

  // Billing state gates (Section 7): read-only mode preserves data but
  // pauses new checks.
  if (agency.billing_status === "canceled") {
    return {
      ok: false,
      message:
        "Your subscription has ended, so new checks are paused. Your data and reports are still here — resubscribe in Settings → Billing to continue.",
    };
  }
  if (
    agency.billing_status === "past_due" &&
    agency.billing_grace_until &&
    new Date(agency.billing_grace_until) < new Date()
  ) {
    return {
      ok: false,
      message:
        "Payment is past due and the grace period has ended. Update your card in Settings → Billing to resume checks.",
    };
  }

  // Usage limits — honest and explicit, never silent overage.
  if (agency.plan === "trial") {
    if (agency.trial_ends_at && new Date(agency.trial_ends_at) < new Date()) {
      return {
        ok: false,
        message: "Your trial has ended. Subscribe in Settings to keep running checks.",
      };
    }
    if (agency.checks_this_period >= TRIAL_CHECK_LIMIT) {
      return {
        ok: false,
        message: `You've used your ${TRIAL_CHECK_LIMIT} trial checks. Subscribe in Settings to keep going.`,
      };
    }
  } else if (agency.checks_this_period >= PAID_CHECK_LIMIT) {
    const resetDate = agency.period_resets_at
      ? new Date(agency.period_resets_at).toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
        })
      : "the 1st";
    return {
      ok: false,
      message: `You've used this month's ${PAID_CHECK_LIMIT} checks. They reset on ${resetDate}, or reply to any email from us to talk about a higher limit.`,
    };
  }

  const admin = createAdminClient();
  if (!admin) return { ok: false, message: "Server not configured. Try again shortly." };

  // Burst rate limit on the upload path: 10 new checks per user per 10 minutes.
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { count: recentCount } = await admin
    .from("events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", profile.user_id)
    .eq("event_name", "check_created")
    .gte("created_at", tenMinutesAgo);
  if ((recentCount ?? 0) >= 10) {
    return {
      ok: false,
      message: "That's a lot of checks at once — wait a few minutes and try again.",
    };
  }

  const { data: check, error } = await admin
    .from("checks")
    .insert({
      agency_id: agency.id,
      label,
      policy_type: policyType,
      status: "queued",
      doc_a_filename: docAName || null,
      doc_b_filename: docBName || null,
    })
    .select("id")
    .single();
  if (error || !check) {
    return { ok: false, message: "Couldn't create the check. Try again." };
  }

  const paths = docPaths(check.id);
  const [a, b] = await Promise.all([
    admin.storage.from("documents").createSignedUploadUrl(paths.a),
    admin.storage.from("documents").createSignedUploadUrl(paths.b),
  ]);
  if (a.error || b.error || !a.data || !b.data) {
    await admin.from("checks").delete().eq("id", check.id);
    return { ok: false, message: "Couldn't prepare the upload. Try again." };
  }

  await admin.from("events").insert({
    agency_id: agency.id,
    user_id: profile.user_id,
    event_name: "check_created",
    metadata: { check_id: check.id, policy_type: policyType },
  });

  return {
    ok: true,
    checkId: check.id,
    uploadA: { url: a.data.signedUrl, token: a.data.token },
    uploadB: { url: b.data.signedUrl, token: b.data.token },
  };
}

export type StartResult = { ok: true } | { ok: false; message: string };

/** Called after the browser has uploaded both PDFs to signed URLs. */
export async function startCheck(checkId: string): Promise<StartResult> {
  const { supabase } = await requireProfile();

  // RLS scopes this select: users can only start their own agency's checks.
  const { data: check } = await supabase
    .from("checks")
    .select("id, status")
    .eq("id", checkId)
    .maybeSingle();
  if (!check) return { ok: false, message: "Check not found." };
  if (check.status !== "queued") return { ok: true };

  const admin = createAdminClient();
  if (!admin) return { ok: false, message: "Server not configured." };

  // Confirm both uploads actually landed before burning pipeline time.
  const { data: objects } = await admin.storage
    .from("documents")
    .list(`checks/${checkId}`);
  const names = new Set((objects ?? []).map((o) => o.name));
  if (!names.has("doc_a.pdf") || !names.has("doc_b.pdf")) {
    return { ok: false, message: "One of the uploads didn't finish. Try again." };
  }

  after(async () => {
    await runCheck(checkId);
  });

  return { ok: true };
}
