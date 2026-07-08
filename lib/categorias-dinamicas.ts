// ─── Funciones para construir NAV_ITEMS dinámicamente ──────────────────────────

import { createAdminClient } from "@/lib/supabase/admin";
import type { NavItem, NavColumna, NavLink } from "@/lib/categorias";

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

/**
 * Obtiene todas las subcategorías activas desde la BD
 */
export async function obtenerSubcategoriasDinamicas(): Promise<Subcategoria[]> {
  const supa = createAdminClient();
  // Usar headers para forzar no-store en Next.js
  const headers = new Headers();
  headers.append('Cache-Control', 'no-store');
  
  const { data, error } = await supa
    .from("subcategorias")
    .select("*")
    .eq("activa", true)
    .order("orden", { ascending: true });

  if (error) {
    console.error("Error al obtener subcategorías:", error.message);
    return [];
  }

  return (data || []) as Subcategoria[];
}

/**
 * Obtiene una subcategoría específica por categoría y slug
 */
export async function obtenerSubcategoriaDetalles(
  categoria: string,
  slug: string
): Promise<Subcategoria | null> {
  const supa = createAdminClient();
  const { data, error } = await supa
    .from("subcategorias")
    .select("*")
    .eq("categoria", categoria)
    .eq("slug", slug)
    .eq("activa", true)
    .single();

  if (error) return null;
  return (data || null) as Subcategoria;
}

/**
 * Obtiene lista de todas las subcategorías (para sitemap, etc.)
 */
export async function obtenerTodasLasSubcategorias(): Promise<
  Array<{ categoria: string; slug: string; updated_at?: string }>
> {
  const supa = createAdminClient();
  const { data, error } = await supa
    .from("subcategorias")
    .select("categoria, slug, updated_at")
    .eq("activa", true)
    .order("orden", { ascending: true });

  if (error) {
    console.error("Error al obtener todas las subcategorías:", error.message);
    return [];
  }

  return (data || []) as Array<{ categoria: string; slug: string; updated_at?: string }>;
}

/**
 * Construye el array NAV_ITEMS dinámicamente desde la BD
 * Agrupa por categoría y columna
 */
export async function construirNavItems(): Promise<NavItem[]> {
  const subcats = await obtenerSubcategoriasDinamicas();

  // Agrupar por categoría
  const byCategory: Record<string, Record<string, Subcategoria[]>> = {};

  for (const sub of subcats) {
    if (!byCategory[sub.categoria]) {
      byCategory[sub.categoria] = {};
    }
    const colName = sub.columna || "General";
    if (!byCategory[sub.categoria][colName]) {
      byCategory[sub.categoria][colName] = [];
    }
    byCategory[sub.categoria][colName].push(sub);
  }

  // Construir NAV_ITEMS con la estructura esperada
  const navItems: NavItem[] = [];

  // Orden de categorías
  const ORDEN_CATEGORIAS = ["peluqueria", "estetica", "barberia", "perfumeria", "marcas", "blog"];
  const NOMBRES_CATEGORIAS: Record<string, string> = {
    peluqueria: "Peluquería",
    estetica: "Estética",
    barberia: "Barbería",
    perfumeria: "Perfumería",
    marcas: "Marcas",
    blog: "Blog",
  };

  for (const cat of ORDEN_CATEGORIAS) {
    const catName = NOMBRES_CATEGORIAS[cat];

    if (cat === "marcas") {
      navItems.push({
        label: "Marcas",
        href: "/marcas",
      });
    } else if (cat === "blog") {
      navItems.push({
        label: "Blog",
        href: "/blog",
      });
    } else if (byCategory[cat]) {
      // Construir columnas agrupadas
      const columnas: NavColumna[] = [];
      const columnasDinamicas = byCategory[cat];

      for (const [colName, subs] of Object.entries(columnasDinamicas)) {
        const links: NavLink[] = subs.map(sub => ({
          label: sub.label,
          href: `/productos/${sub.categoria}/${sub.slug}`,
        }));

        columnas.push({
          titulo: colName,
          links,
        });
      }

      navItems.push({
        label: catName,
        href: `/productos/${cat}`,
        columnas,
      });
    }
  }

  return navItems;
}

/**
 * Obtiene lista plana de pares (categoria, subcategoria) para sugerencias
 * Usa en el importador de productos
 */
export async function obtenerCategoriaPairs(): Promise<Array<{ categoria: string; subcategoria: string; label: string }>> {
  const subcats = await obtenerSubcategoriasDinamicas();
  return subcats.map(s => ({
    categoria: s.categoria,
    subcategoria: s.slug,
    label: `${getNombreCategoria(s.categoria)} › ${s.label}`,
  }));
}

function getNombreCategoria(cat: string): string {
  const NOMBRES: Record<string, string> = {
    peluqueria: "Peluquería",
    estetica: "Estética",
    barberia: "Barbería",
    perfumeria: "Perfumería",
  };
  return NOMBRES[cat] || cat;
}
