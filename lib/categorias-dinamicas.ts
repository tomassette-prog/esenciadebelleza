// ─── Funciones para construir NAV_ITEMS dinámicamente ──────────────────────────

import { unstable_noStore as noStore } from "next/cache";
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

// Fallback completo con las 44 subcategorías (usado cuando la BD no responde)
const FALLBACK_SUBCATEGORIAS: Omit<Subcategoria, "id" | "seo_title" | "seo_description" | "descripcion_intro">[] = [
  // PELUQUERÍA - Coloración
  { categoria: "peluqueria", slug: "tintes", label: "Tintes", columna: "Coloración", orden: 1, activa: true },
  { categoria: "peluqueria", slug: "decoloracion", label: "Decoloración", columna: "Coloración", orden: 2, activa: true },
  { categoria: "peluqueria", slug: "oxigenadas", label: "Oxigenadas", columna: "Coloración", orden: 3, activa: true },
  { categoria: "peluqueria", slug: "sin-amoniaco", label: "Sin amoniaco", columna: "Coloración", orden: 4, activa: true },
  // PELUQUERÍA - Cuidado Capilar
  { categoria: "peluqueria", slug: "champus", label: "Champús", columna: "Cuidado Capilar", orden: 5, activa: true },
  { categoria: "peluqueria", slug: "mascarillas", label: "Mascarillas", columna: "Cuidado Capilar", orden: 6, activa: true },
  { categoria: "peluqueria", slug: "acondicionadores", label: "Acondicionadores", columna: "Cuidado Capilar", orden: 7, activa: true },
  { categoria: "peluqueria", slug: "ampollas-y-serums", label: "Ampollas y Sérums", columna: "Cuidado Capilar", orden: 8, activa: true },
  { categoria: "peluqueria", slug: "tratamientos", label: "Tratamientos", columna: "Cuidado Capilar", orden: 9, activa: true },
  // PELUQUERÍA - Styling
  { categoria: "peluqueria", slug: "lacas", label: "Lacas", columna: "Styling", orden: 10, activa: true },
  { categoria: "peluqueria", slug: "espumas", label: "Espumas", columna: "Styling", orden: 11, activa: true },
  { categoria: "peluqueria", slug: "gominas-y-ceras", label: "Gominas y Ceras", columna: "Styling", orden: 12, activa: true },
  { categoria: "peluqueria", slug: "sprays", label: "Sprays", columna: "Styling", orden: 13, activa: true },
  { categoria: "peluqueria", slug: "rizos", label: "Rizos y Anticrespo", columna: "Styling", orden: 14, activa: true },
  { categoria: "peluqueria", slug: "permanentes", label: "Permanentes", columna: "Styling", orden: 15, activa: true },
  // PELUQUERÍA - Equipos y Herramientas
  { categoria: "peluqueria", slug: "secadores-y-planchas", label: "Secadores y Planchas", columna: "Equipos y Herramientas", orden: 15, activa: true },
  { categoria: "peluqueria", slug: "maquinas-corte", label: "Máquinas de corte", columna: "Equipos y Herramientas", orden: 16, activa: true },
  { categoria: "peluqueria", slug: "cepillos-y-peines", label: "Cepillos y Peines", columna: "Equipos y Herramientas", orden: 17, activa: true },
  { categoria: "peluqueria", slug: "tijeras", label: "Tijeras y Navajas", columna: "Equipos y Herramientas", orden: 18, activa: true },
  { categoria: "peluqueria", slug: "batas-y-capas", label: "Batas y Capas", columna: "Equipos y Herramientas", orden: 19, activa: true },
  { categoria: "peluqueria", slug: "utensilios", label: "Utensilios y Accesorios", columna: "Equipos y Herramientas", orden: 20, activa: true },
  { categoria: "peluqueria", slug: "mobiliario", label: "Mobiliario", columna: "Equipos y Herramientas", orden: 21, activa: true },
  // ESTÉTICA - Facial
  { categoria: "estetica", slug: "cremas-faciales", label: "Cremas faciales", columna: "Facial", orden: 22, activa: true },
  { categoria: "estetica", slug: "mascarillas-faciales", label: "Mascarillas faciales", columna: "Facial", orden: 23, activa: true },
  { categoria: "estetica", slug: "serums-faciales", label: "Sérums y Contorno de ojos", columna: "Facial", orden: 24, activa: true },
  { categoria: "estetica", slug: "gel-facial", label: "Gel facial y limpieza", columna: "Facial", orden: 25, activa: true },
  // ESTÉTICA - Corporal
  { categoria: "estetica", slug: "cremas-corporales", label: "Cremas corporales", columna: "Corporal", orden: 26, activa: true },
  { categoria: "estetica", slug: "aceites-corporales", label: "Aceites corporales", columna: "Corporal", orden: 27, activa: true },
  { categoria: "estetica", slug: "leche-corporal", label: "Leche corporal", columna: "Corporal", orden: 28, activa: true },
  { categoria: "estetica", slug: "gel-corporal", label: "Gel de ducha", columna: "Corporal", orden: 29, activa: true },
  { categoria: "estetica", slug: "peeling", label: "Peeling y Exfoliantes", columna: "Corporal", orden: 30, activa: true },
  // ESTÉTICA - Depilación
  { categoria: "estetica", slug: "ceras-depiladoras", label: "Ceras depiladoras", columna: "Depilación", orden: 31, activa: true },
  { categoria: "estetica", slug: "depilatorios", label: "Depilatorios", columna: "Depilación", orden: 32, activa: true },
  // ESTÉTICA - Uñas y Maquillaje
  { categoria: "estetica", slug: "manicura-pedicura", label: "Manicura y Pedicura", columna: "Uñas y Maquillaje", orden: 33, activa: true },
  { categoria: "estetica", slug: "unas", label: "Limas y Fresas", columna: "Uñas y Maquillaje", orden: 34, activa: true },
  { categoria: "estetica", slug: "lamparas-uv", label: "Lámparas UV/LED", columna: "Uñas y Maquillaje", orden: 35, activa: true },
  { categoria: "estetica", slug: "maquillaje", label: "Maquillaje", columna: "Uñas y Maquillaje", orden: 36, activa: true },
  // BARBERÍA
  { categoria: "barberia", slug: "ceras-barbero", label: "Ceras de barbero", columna: "Afeitado y Barba", orden: 37, activa: true },
  { categoria: "barberia", slug: "champus-barba", label: "Champús de barba", columna: "Afeitado y Barba", orden: 38, activa: true },
  { categoria: "barberia", slug: "cuidado-caballero", label: "Cuidado caballero", columna: "Styling y cuidado caballero", orden: 39, activa: true },
  // PERFUMERÍA
  { categoria: "perfumeria", slug: "eau-de-parfum", label: "Eau de Parfum", columna: "Perfumes", orden: 40, activa: true },
  { categoria: "perfumeria", slug: "eau-de-toilette", label: "Eau de Toilette", columna: "Perfumes", orden: 41, activa: true },
  { categoria: "perfumeria", slug: "colonias", label: "Colonias", columna: "Perfumes", orden: 42, activa: true },
  { categoria: "perfumeria", slug: "ambientadores", label: "Ambientadores", columna: "Ambientación", orden: 43, activa: true },
  { categoria: "perfumeria", slug: "brumas-y-velas", label: "Brumas y Velas", columna: "Ambientación", orden: 44, activa: true },
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
  noStore(); // Nunca cachear — siempre leer de BD
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
