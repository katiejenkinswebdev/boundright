import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAuthorizedCron } from "../route-helpers";

const DAY_MS = 24 * 60 * 60 * 1000;

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

  if (stale.length > 0) {
    await admin.storage.from("documents").remove(stale);
    await admin.from("events").insert({
      event_name: "deletion_guardrail_triggered",
      metadata: { files: stale },
    });
  }

  return NextResponse.json({ staleFilesDeleted: stale.length });
}
