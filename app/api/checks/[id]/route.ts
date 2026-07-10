import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

/** Status polling endpoint for the check progress screen. RLS applies. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const { data: check } = await supabase
    .from("checks")
    .select("id, status, failure_reason, label")
    .eq("id", id)
    .maybeSingle();

  if (!check) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(check);
}
