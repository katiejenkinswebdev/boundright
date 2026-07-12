import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Uptime probe for monitors and the deploy pipeline's smoke test. 200 when
 * the app can serve and reach the database; 503 otherwise. No auth: it
 * reveals nothing but up/down.
 */
export async function GET() {
  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ ok: false, db: "unconfigured" }, { status: 503 });
  }
  const { error } = await admin.from("agencies").select("id").limit(1);
  if (error) {
    return NextResponse.json({ ok: false, db: "unreachable" }, { status: 503 });
  }
  return NextResponse.json({ ok: true, db: "ok" });
}
