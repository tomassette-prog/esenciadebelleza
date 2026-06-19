"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { slugifyCategoria } from "@/lib/seo";

export interface ProductoSugerido {
  nombre: string;
  marca: string | null;
  url: string;
}

// Palabras a ignorar en la búsqueda
const STOP_WORDS = new Set([
  "de", "del", "la", "las", "los", "el", "en", "y", "o", "a", "un", "una",
  "para", "con", "sin", "por", "pro", "kit", "set", "pack", "ml", "gr", "lt",
  "and", "for", "the", "with",
]);

export async function buscarProductosParaEnlace(
  query: string
): Promise<ProductoSugerido[]> {
  if (!query || query.trim().length < 2) return [];

  const supabase = createAdminClient();

  // Estrategia 1: buscar el string completo
  const { data: exactos } = await supabase
    .from("productos_padre")
    .select("nombre, slug, categoria, subcategoria, marca:marcas(nombre)")
    .eq("activo", true)
    .ilike("nombre", `%${query.trim()}%`)
    .order("nombre")
    .limit(6);

  if (exactos && exactos.length > 0) {
    return mapear(exactos);
  }

  // Estrategia 2: buscar cada palabra significativa con OR
  const palabras = query
    .split(/\s+/)
    .map(p => p.replace(/[^a-záéíóúàèìòùäëïöüñ0-9]/gi, "").toLowerCase())
    .filter(p => p.length > 3 && !STOP_WORDS.has(p));

  if (palabras.length === 0) return [];

  // Construir filtro OR: nombre ILIKE '%palabra1%' OR nombre ILIKE '%palabra2%'
  const filtroOr = palabras.map(p => `nombre.ilike.%${p}%`).join(",");

  const { data: porPalabras } = await supabase
    .from("productos_padre")
    .select("nombre, slug, categoria, subcategoria, marca:marcas(nombre)")
    .eq("activo", true)
    .or(filtroOr)
    .order("nombre")
    .limit(8);

  if (!porPalabras || porPalabras.length === 0) return [];

  // Ordenar por relevancia: más palabras que coinciden = más arriba
  const scored = porPalabras.map(p => {
    const nombreLower = p.nombre.toLowerCase();
    const coincidencias = palabras.filter(w => nombreLower.includes(w)).length;
    return { ...p, score: coincidencias };
  });
  scored.sort((a, b) => b.score - a.score);

  return mapear(scored.slice(0, 6));
}

function mapear(data: { nombre: string; slug: string; categoria: string; subcategoria: string | null; marca: unknown }[]): ProductoSugerido[] {
  return data.map((p) => ({
    nombre: p.nombre,
    marca: (p.marca as unknown as { nombre: string } | null)?.nombre ?? null,
    url: `/productos/${slugifyCategoria(p.categoria)}/${slugifyCategoria(p.subcategoria ?? "general")}/${p.slug}`,
  }));
}

