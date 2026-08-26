"use server";

import { revalidatePath } from "next/cache";
import { createClient as createSupabase } from "@supabase/supabase-js";
import { verificarAdmin } from "@/lib/admin-auth";

function adminClient() {
  return createSupabase(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function guardarMapeoCategoria(data: {
  woo_cat_id: number;
  woo_cat_name: string | null;
  categoria: string;
  subcategoria: string;
}): Promise<{ ok?: boolean; error?: string }> {
  await verificarAdmin();
  const supa = adminClient();
  const { error } = await supa.from("woo_cat_mappings").upsert(data, { onConflict: "woo_cat_id" });
  if (error) return { error: error.message };
  return { ok: true };
}

export async function eliminarMapeoCategoria(woo_cat_id: number): Promise<{ ok?: boolean; error?: string }> {
  await verificarAdmin();
  const supa = adminClient();
  const { error } = await supa.from("woo_cat_mappings").delete().eq("woo_cat_id", woo_cat_id);
  if (error) return { error: error.message };
  return { ok: true };
}

// ─── Subcategorías dinámicas ──────────────────────────────────────────────

export interface Subcategoria {
  id: string;
  categoria: string;
  slug: string;
  label: string;
  columna: string | null;
  orden: number;
  seo_title: string | null;
  seo_description: string | null;
  descripcion_intro: string | null;
  activa: boolean;
}

export async function obtenerSubcategorias(
  categoria?: string
): Promise<{ data?: Subcategoria[]; error?: string }> {
  const supa = adminClient();
  let query = supa.from("subcategorias").select("*");

  if (categoria) {
    query = query.eq("categoria", categoria);
  }

  const { data, error } = await query.order("orden", { ascending: true });
  if (error) return { error: error.message };
  return { data: data as Subcategoria[] };
}

export async function crearSubcategoria(data: {
  categoria: string;
  slug: string;
  label: string;
  columna: string | null;
  orden: number;
  seo_title?: string | null;
  seo_description?: string | null;
}): Promise<{ data?: Subcategoria; error?: string }> {
  await verificarAdmin();
  const supa = adminClient();

  const { data: result, error } = await supa
    .from("subcategorias")
    .insert([{ ...data, activa: true }])
    .select()
    .single();

  if (error) return { error: error.message };
  
  // Revalidar para que aparezca inmediatamente en la navbar
  revalidatePath("/");
  revalidatePath("/admin/categorias");
  
  return { data: result as Subcategoria };
}

export async function actualizarSubcategoria(
  id: string,
  data: Partial<Subcategoria>
): Promise<{ data?: Subcategoria; error?: string }> {
  await verificarAdmin();
  const supa = adminClient();

  const { data: result, error } = await supa
    .from("subcategorias")
    .update(data)
    .eq("id", id)
    .select()
    .single();

  if (error) return { error: error.message };
  
  // Revalidar para que cambios de "activa" se reflejen inmediatamente en navbar
  revalidatePath("/");
  revalidatePath("/admin/categorias");
  
  return { data: result as Subcategoria };
}

export async function eliminarSubcategoria(id: string): Promise<{ ok?: boolean; error?: string }> {
  await verificarAdmin();
  const supa = adminClient();
  const { error } = await supa.from("subcategorias").delete().eq("id", id);
  if (error) return { error: error.message };
  
  // Revalidar para que desaparezca de la navbar
  revalidatePath("/");
  revalidatePath("/admin/categorias");
  
  return { ok: true };
}

/**
 * Obtiene subcategorías por categoría:
 * - Primero: de tabla `subcategorias` (dinámicas)
 * - Después: de productos existentes (para compatibilidad)
 * - Deduplica y ordena alfabéticamente
 */
export async function obtenerSubcategoriasPorCategoria(
  categoria: string
): Promise<{ data?: string[]; error?: string }> {
  const supa = adminClient();

  // 1. Obtener dinámicas (sin filtro de activa, confiando en DEFAULT true)
  const { data: dinamicas, error: errD } = await supa
    .from("subcategorias")
    .select("slug, activa")
    .eq("categoria", categoria)
    .order("orden", { ascending: true });

  if (errD && errD.code !== "PGRST116") {
    // PGRST116 = tabla no existe (aún no ejecutada la migración)
    return { error: errD.message };
  }

  // 2. Obtener de productos existentes
  const { data: deProductos } = await supa
    .from("productos_padre")
    .select("subcategoria")
    .eq("categoria", categoria)
    .eq("activo", true)
    .not("subcategoria", "is", null);

  // 3. Combinar: dinámicas primero (excluyendo explícitamente inactivas), luego productos
  const set = new Set<string>();
  for (const d of dinamicas ?? []) {
    // Include if slug exists AND (activa is true OR activa is null = default true)
    if (d.slug && d.activa !== false) {
      set.add(d.slug);
    }
  }
  for (const p of deProductos ?? []) {
    if (p.subcategoria) set.add(p.subcategoria);
  }

  const result = Array.from(set).sort();
  return { data: result };
}
