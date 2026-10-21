import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { estaAutorizado } from "@/lib/cron-auth";
import { ejecutarTrabajoConversion } from "@/lib/trabajo-conversion";

export const maxDuration = 300;

/**
 * Manual trigger for the conversion email job (review requests, abandoned
 * carts, restock notices). The scheduled run piggybacks on the daily mirror
 * cron to stay below the Vercel cron limit; this endpoint exists for on-demand
 * runs and smoke tests (auth: Bearer CRON_SECRET or x-mirror-token).
 */
export async function GET(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  if (!(await estaAutorizado(req, supabase))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await ejecutarTrabajoConversion());
}
