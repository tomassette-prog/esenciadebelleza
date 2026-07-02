import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createAdminClient();
  const { data: packs } = await supabase
    .from("packs_regalo")
    .select("id, nombre, slug, precio_pack, precio_original, activo, destacado, orden, imagen_url")
    .order("orden");

  if (!packs?.length) return NextResponse.json([]);

  const packIds = packs.map((p) => p.id);
  const { data: items } = await supabase
    .from("packs_regalo_items")
    .select("pack_id, variacion_id, cantidad")
    .in("pack_id", packIds);

  const itemsByPack = new Map<string, { variacion_id: string; cantidad: number }[]>();
  for (const item of items ?? []) {
    const arr = itemsByPack.get(item.pack_id) ?? [];
    arr.push({ variacion_id: item.variacion_id, cantidad: item.cantidad });
    itemsByPack.set(item.pack_id, arr);
  }

  const result = packs.map((p) => ({
    ...p,
    items: itemsByPack.get(p.id) ?? [],
  }));

  return NextResponse.json(result);
}
