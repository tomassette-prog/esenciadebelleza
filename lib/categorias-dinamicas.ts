// ─── Funciones para construir NAV_ITEMS dinámicamente ──────────────────────────

import { createClient } from "@supabase/supabase-js";
import type { NavItem, NavColumna, NavLink } from "@/lib/categorias";

// Cliente anon para leer datos públicos (subcategorias no tiene RLS)
function createAnonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
}

// Fallback hardcodeado si la BD no responde
const FALLBACK_SUBCATEGORIAS: Omit<Subcategoria, "id" | "seo_title" | "seo_description" | "descripcion_intro">[] = [
  { categoria: "peluqueria", slug: "tintes", label: "Tintes", columna: "Coloración", orden: 1, activa: true },
  { categoria: "peluqueria", slug: "decoloracion", label: "Decoloración", columna: "Coloración", orden: 2, activa: true },
  { categoria: "peluqueria", slug: "tratamientos-capilares", label: "Tratamientos", columna: "Cuidado Capilar", orden: 3, activa: true },
  { categoria: "peluqueria", slug: "champus", label: "Champús", columna: "Cuidado Capilar", orden: 4, activa: true },
  { categoria: "peluqueria", slug: "mascarillas", label: "Mascarillas", columna: "Cuidado Capilar", orden: 5, activa: true },
  { categoria: "peluqueria", slug: "styling", label: "Styling", columna: "Styling", orden: 6, activa: true },
  { categoria: "peluqueria", slug: "secadores", label: "Secadores", columna: "Equipos y Herramientas", orden: 7, activa: true },
  { categoria: "peluqueria", slug: "planchas", label: "Planchas", columna: "Equipos y Herramientas", orden: 8, activa: true },
  { categoria: "estetica", slug: "facial", label: "Facial", columna: "Facial", orden: 1, activa: true },
  { categoria: "estetica", slug: "corporal", label: "Corporal", columna: "Corporal", orden: 2, activa: true },
  { categoria: "estetica", slug: "depilacion", label: "Depilación", columna: "Depilación", orden: 3, activa: true },
  { categoria: "estetica", slug: "unas", label: "Uñas", columna: "Uñas y Maquillaje", orden: 4, activa: true },
  { categoria: "barberia", slug: "afeitado", label: "Afeitado y Barba", columna: "Afeitado", orden: 1, activa: true },
  { categoria: "perfumeria", slug: "perfumes", label: "Perfumes", columna: "Perfumes", orden: 1, activa: true },
];

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
  try {
    const supa = createAnonClient();
    const { data, error } = await supa
      .from("subcategorias")
      .select("*")
      .eq("activa", true)
      .order("orden", { ascending: true });

    if (error) {
      console.error("Error al obtener subcategorías:", error.message);
      return FALLBACK_SUBCATEGORIAS as Subcategoria[];
    }

    const result = (data || []) as Subcategoria[];
    // Si la BD devuelve vacío, usar fallback para no romper la navbar
    return result.length > 0 ? result : FALLBACK_SUBCATEGORIAS as Subcategoria[];
  } catch (err) {
    console.error("Error crítico al obtener subcategorías:", err);
    return FALLBACK_SUBCATEGORIAS as Subcategoria[];
  }
}

/**
 * Obtiene una subcategoría específica por categoría y slug
 */
export async function obtenerSubcategoriaDetalles(
  categoria: string,
  slug: string
): Promise<Subcategoria | null> {
  const supa = createAnonClient();
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
  const supa = createAnonClient();
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
