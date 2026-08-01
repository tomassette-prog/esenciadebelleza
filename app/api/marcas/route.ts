import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("marcas")
    .select("id, nombre")
    .order("nombre");
  if (error) return NextResponse.json([], { status: 500 });
  return NextResponse.json(data ?? [], {
    headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
  });
}
