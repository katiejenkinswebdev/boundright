import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedCron } from "../route-helpers";

const DAY_MS = 24 * 60 * 60 * 1000;
const INTAKE_TTL_MS = 2 * DAY_MS;

/**
 * Nightly guardrail for the privacy promise: any document file older than
 * 24 hours means the pipeline's deletion failed. Delete it and record an
 * alert event (surfaced in the admin view / weekly ops email).
 */
export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "not configured" }, { status: 503 });

  const stale: string[] = [];
  const { data: dirs } = await admin.storage.from("documents").list("checks", {
    limit: 1000,
  });
  for (const dir of dirs ?? []) {
    const { data: files } = await admin.storage
      .from("documents")
      .list(`checks/${dir.name}`);
    for (const f of files ?? []) {
      const created = new Date(f.created_at ?? 0).getTime();
      if (Date.now() - created > DAY_MS) {
        stale.push(`checks/${dir.name}/${f.name}`);
      }
    }
  }

  // Smart-intake staging: unpaired files older than 48h are removed
  // (disclosed on /ai and in the intake UI).
  const { data: intakeDirs } = await admin.storage.from("documents").list("intake", { limit: 1000 });
  for (const dir of intakeDirs ?? []) {
    const { data: files } = await admin.storage.from("documents").list(`intake/${dir.name}`);
    for (const f2 of files ?? []) {
      if (Date.now() - new Date(f2.created_at ?? 0).getTime() > INTAKE_TTL_MS) {
        stale.push(`intake/${dir.name}/${f2.name}`);
      }
    }
  }

  if (stale.length > 0) {
    await admin.storage.from("documents").remove(stale);
    await admin.from("events").insert({
      event_name: "deletion_guardrail_triggered",
      metadata: { files: stale },
    });
  }

  return NextResponse.json({ staleFilesDeleted: stale.length });
}
