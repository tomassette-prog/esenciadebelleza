import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const supa = createAdminClient();
    const { data } = await supa.from("backfill_progress").select("payload").eq("id", 1).single();
    if (data?.payload) return NextResponse.json(JSON.parse(data.payload));
  } catch { /* tabla no existe o error */ }
  return NextResponse.json({ phase: "idle", current: 0, total: 0, done: true });
}
