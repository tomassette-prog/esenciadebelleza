import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json([]);

  const supabase = createAdminClient();
  const words = q.split(/\s+/).filter((w) => w.length >= 2);
  const orProducto = words.map((w) => `nombre.ilike.%${w}%`).join(",");
  const orSku = words.map((w) => `sku.ilike.%${w}%`).join(",");

  // Buscar por SKU directo
  const { data: porSku } = await supabase
    .from("productos_variaciones")
    .select(`
      id, sku, nombre_variacion, precio_b2c, stock, imagen_url,
      producto_padre:productos_padre(id, nombre, slug, categoria, subcategoria)
    `)
    .or(orSku)
    .eq("activa", true)
    .limit(10);

  // Buscar por nombre del producto padre
  const { data: padres } = await supabase
    .from("productos_padre")
    .select("id")
    .or(orProducto)
    .eq("activo", true)
    .limit(20);

  const padreIds = (padres ?? []).map((p: { id: string }) => p.id);
  const { data: porNombre } = padreIds.length
    ? await supabase
        .from("productos_variaciones")
        .select(`
          id, sku, nombre_variacion, precio_b2c, stock, imagen_url,
          producto_padre:productos_padre(id, nombre, slug, categoria, subcategoria)
        `)
        .in("producto_padre_id", padreIds)
        .eq("activa", true)
        .limit(20)
    : { data: [] };

  // Deduplicar por id
  const seen = new Set<string>();
  const combined = [...(porSku ?? []), ...(porNombre ?? [])].filter((v: { id: string }) => {
    if (seen.has(v.id)) return false;
    seen.add(v.id);
    return true;
  });

  return NextResponse.json(combined.slice(0, 20));
}
