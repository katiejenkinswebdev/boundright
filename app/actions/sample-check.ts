"use server";

import fs from "node:fs/promises";
import path from "node:path";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { runCheck, docPaths } from "@/lib/pipeline/run";

export type SampleCheckState = { status: "idle" | "error"; message: string };

/**
 * Guaranteed-successful first experience: runs the bundled specimen pair
 * (Acme Manufacturing GL renewal) through the real pipeline. Nothing the
 * agency owns is uploaded. Doubles as the sales demo mode.
 */
export async function runSampleCheck(
  _prev: SampleCheckState,
  _formData: FormData
): Promise<SampleCheckState> {
  const { agency, profile } = await requireProfile();
  const admin = createAdminClient();
  if (!admin) return { status: "error", message: "Server not configured. Try again shortly." };

  const { data: check, error } = await admin
    .from("checks")
    .insert({
      agency_id: agency.id,
      label: "Sample: Acme Mfg GL Renewal",
      policy_type: "GL",
      status: "queued",
      source: "sample",
      doc_a_filename: "acme_proposal.pdf",
      doc_b_filename: "acme_issued_policy.pdf",
    })
    .select("id")
    .single();
  if (error || !check) {
    return { status: "error", message: "Couldn't start the sample check. Try again." };
  }

  const specimens = path.join(process.cwd(), "public", "specimens");
  const paths = docPaths(check.id);
  for (const [p, file] of [
    [paths.a, "pair1_proposal.pdf"],
    [paths.b, "pair1_policy.pdf"],
  ] as const) {
    const bytes = await fs.readFile(path.join(specimens, file));
    const { error: uploadErr } = await admin.storage
      .from("documents")
      .upload(p, bytes, { contentType: "application/pdf" });
    if (uploadErr) {
      await admin.from("checks").delete().eq("id", check.id);
      return { status: "error", message: "Couldn't start the sample check. Try again." };
    }
  }

  await admin.from("events").insert({
    agency_id: agency.id,
    user_id: profile.user_id,
    event_name: "sample_check_run",
    metadata: { check_id: check.id },
  });

  after(async () => {
    await runCheck(check.id);
  });

  redirect(`/checks/${check.id}`);
}
