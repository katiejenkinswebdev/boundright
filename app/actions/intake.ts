"use server";

import { randomUUID } from "node:crypto";
import { after } from "next/server";
import { requireProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ingestPdf } from "@/lib/pipeline/pdf";
import { classifyDocument, emptyUsage } from "@/lib/pipeline/claude";
import { runCheck, docPaths } from "@/lib/pipeline/run";
import { pairDocuments, type ClassifiedDoc, type ProposedPair } from "@/lib/intake";

const MAX_INTAKE_FILES = 30;

async function requireSmartIntake() {
  const ctx = await requireProfile();
  if (!ctx.agency.smart_intake_enabled) {
    throw new Error("Smart intake isn't enabled for this agency.");
  }
  return ctx;
}

export type IntakeUploadsResult =
  | { ok: true; uploads: { path: string; url: string }[] }
  | { ok: false; message: string };

/** Signed staging URLs for the dropped files (intake/<agency>/<uuid>.pdf). */
export async function createIntakeUploads(
  fileNames: string[]
): Promise<IntakeUploadsResult> {
  const { agency } = await requireSmartIntake();
  if (fileNames.length < 2) return { ok: false, message: "Drop at least 2 PDFs." };
  if (fileNames.length > MAX_INTAKE_FILES) {
    return { ok: false, message: `Up to ${MAX_INTAKE_FILES} files at a time.` };
  }
  const admin = createAdminClient();
  if (!admin) return { ok: false, message: "Server not configured." };

  const uploads: { path: string; url: string }[] = [];
  for (const _ of fileNames) {
    const path = `intake/${agency.id}/${randomUUID()}.pdf`;
    const { data, error } = await admin.storage
      .from("documents")
      .createSignedUploadUrl(path);
    if (error || !data) return { ok: false, message: "Couldn't prepare uploads." };
    uploads.push({ path, url: data.signedUrl });
  }
  return { ok: true, uploads };
}

export type ClassifyResult =
  | {
      ok: true;
      pairs: ProposedPair[];
      orphans: ClassifiedDoc[];
      failures: { filename: string; reason: string }[];
    }
  | { ok: false; message: string };

/** Classify every staged file (first pages only) and propose pairs. */
export async function classifyIntake(
  files: { path: string; filename: string }[]
): Promise<ClassifyResult> {
  const { agency } = await requireSmartIntake();
  const admin = createAdminClient();
  if (!admin) return { ok: false, message: "Server not configured." };

  const usage = emptyUsage();
  const classified: ClassifiedDoc[] = [];
  const failures: { filename: string; reason: string }[] = [];

  await Promise.all(
    files.slice(0, MAX_INTAKE_FILES).map(async ({ path, filename }) => {
      if (!path.startsWith(`intake/${agency.id}/`)) {
        failures.push({ filename, reason: "Invalid file path." });
        return;
      }
      const { data: blob } = await admin.storage.from("documents").download(path);
      if (!blob) {
        failures.push({ filename, reason: "Upload didn't finish." });
        return;
      }
      const ingest = await ingestPdf(new Uint8Array(await blob.arrayBuffer()));
      if (!ingest.ok) {
        failures.push({
          filename,
          reason:
            ingest.reason === "password_protected"
              ? "Password-protected. Remove the password and re-add."
              : "Not a readable PDF.",
        });
        await admin.storage.from("documents").remove([path]);
        return;
      }
      try {
        const firstPages = ingest.pages.slice(0, 2).map((t, i) => `=== PAGE ${i + 1} ===\n${t}`).join("\n\n");
        const c = await classifyDocument(firstPages, usage);
        classified.push({ ...c, path, filename, scanned: ingest.scanned });
      } catch {
        failures.push({ filename, reason: "Couldn't classify this document." });
      }
    })
  );

  await admin.from("events").insert({
    agency_id: agency.id,
    event_name: "intake_classified",
    metadata: { files: files.length, cost_cents: Math.round(usage.costCents) },
  });

  const { pairs, orphans } = pairDocuments(classified);
  return { ok: true, pairs, orphans, failures };
}

export type RunPairsResult =
  | { ok: true; checkIds: string[] }
  | { ok: false; message: string };

/** Human-confirmed pairs become checks; unused staged files are removed. */
export async function runIntakePairs(
  pairs: {
    aPath: string;
    bPath: string;
    aFilename: string;
    bFilename: string;
    label: string;
    checkType: string;
    policyType: string;
  }[],
  discardPaths: string[]
): Promise<RunPairsResult> {
  const { agency, profile } = await requireSmartIntake();
  const admin = createAdminClient();
  if (!admin) return { ok: false, message: "Server not configured." };
  if (pairs.length === 0) return { ok: false, message: "Confirm at least one pair." };

  // Same honest gates as single checks.
  const cap = agency.plan === "trial" ? 10 : 150;
  if (agency.billing_status === "canceled") {
    return { ok: false, message: "Your subscription has ended. Resubscribe to run checks." };
  }
  if (agency.checks_this_period + pairs.length > cap) {
    return {
      ok: false,
      message: `This would run ${pairs.length} checks but only ${Math.max(0, cap - agency.checks_this_period)} remain this period.`,
    };
  }

  const checkIds: string[] = [];
  for (const p of pairs) {
    if (
      !p.aPath.startsWith(`intake/${agency.id}/`) ||
      !p.bPath.startsWith(`intake/${agency.id}/`)
    ) {
      return { ok: false, message: "Invalid file path in a pair." };
    }
    const { data: check, error } = await admin
      .from("checks")
      .insert({
        agency_id: agency.id,
        label: p.label.slice(0, 120) || "Smart intake check",
        policy_type: ["GL", "Property", "WC", "Auto", "Umbrella", "Package"].includes(p.policyType)
          ? p.policyType
          : "Other",
        check_type: ["issuance", "renewal", "coi"].includes(p.checkType) ? p.checkType : "issuance",
        status: "queued",
        doc_a_filename: p.aFilename,
        doc_b_filename: p.bFilename,
      })
      .select("id")
      .single();
    if (error || !check) return { ok: false, message: "Couldn't create a check." };

    const dest = docPaths(check.id);
    for (const [from, to] of [
      [p.aPath, dest.a],
      [p.bPath, dest.b],
    ] as const) {
      const { error: mvErr } = await admin.storage.from("documents").move(from, to);
      if (mvErr) {
        await admin.from("checks").delete().eq("id", check.id);
        return { ok: false, message: "Couldn't stage a pair's files." };
      }
    }
    checkIds.push(check.id);
  }

  if (discardPaths.length > 0) {
    const safe = discardPaths.filter((d) => d.startsWith(`intake/${agency.id}/`));
    if (safe.length) await admin.storage.from("documents").remove(safe);
  }

  await admin.from("events").insert({
    agency_id: agency.id,
    user_id: profile.user_id,
    event_name: "check_created",
    metadata: { source: "smart_intake", count: checkIds.length },
  });

  after(async () => {
    for (const id of checkIds) await runCheck(id);
  });

  return { ok: true, checkIds };
}
