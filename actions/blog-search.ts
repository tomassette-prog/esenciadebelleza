"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { slugifyCategoria } from "@/lib/seo";

export interface ProductoSugerido {
  nombre: string;
  marca: string | null;
  url: string;
}

export async function buscarProductosParaEnlace(
  query: string
): Promise<ProductoSugerido[]> {
  if (!query || query.trim().length < 2) return [];

  const supabase = createAdminClient();

  // Buscar por nombre e ilike — hasta 6 resultados relevantes
  const { data } = await supabase
    .from("productos_padre")
    .select("nombre, slug, categoria, subcategoria, marca:marcas(nombre)")
    .eq("activo", true)
    .ilike("nombre", `%${query.trim()}%`)
    .order("nombre")
    .limit(6);

  return (data ?? []).map((p) => ({
    nombre: p.nombre,
    marca: (p.marca as unknown as { nombre: string } | null)?.nombre ?? null,
    url: `/productos/${slugifyCategoria(p.categoria)}/${slugifyCategoria(p.subcategoria ?? "general")}/${p.slug}`,
  }));
}
