import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data: pack } = await supabase
    .from("packs_regalo")
    .select("*")
    .eq("id", id)
    .single();

  if (!pack) return NextResponse.json(null, { status: 404 });

  const { data: items } = await supabase
    .from("packs_regalo_items")
    .select("variacion_id, cantidad")
    .eq("pack_id", id);

  return NextResponse.json({ ...pack, items: items ?? [] });
}
