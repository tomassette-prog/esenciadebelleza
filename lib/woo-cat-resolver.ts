/**
 * lib/woo-cat-resolver.ts
 *
 * Resolución unificada de categorías WooCommerce → Esencia de Belleza.
 * Usada por: import admin, cron sync-precios, webhook WooCommerce.
 *
 * Estrategia (en orden):
 *   1. DB `woo_cat_mappings` (persistida por import admin o suggestCategory)
 *   2. Hardcoded `WOO_CAT_MAP` en lib/categorias.ts
 *   3. Parent chain walking (sube por jerarquía WC hasta 5 niveles)
 *   4. Fallback: "peluqueria" / "peluqueria-general"
 */

import { createClient } from "@supabase/supabase-js";
import { WOO_CAT_MAP } from "@/lib/categorias";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CategoriaMapping {
  categoria: string;
  subcategoria: string;
}

export interface WooCategory {
  id: number;
  slug: string;
  name?: string;
  parent: number;
}

// ─── DB Map Cache ─────────────────────────────────────────────────────────────

let _dbCatMap: Map<number, CategoriaMapping> | null = null;
let _dbCatMapLoaded = false;

/**
 * Carga el mapeo desde la tabla `woo_cat_mappings` en Supabase.
 * Cachea el resultado para la duración de la ejecución.
 */
export async function getDbCatMap(): Promise<Map<number, CategoriaMapping>> {
  if (_dbCatMapLoaded && _dbCatMap) return _dbCatMap;

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    const { data } = await supabase
      .from("woo_cat_mappings")
      .select("woo_cat_id, categoria, subcategoria");

    if (data && data.length > 0) {
      _dbCatMap = new Map(
        data.map((r: { woo_cat_id: number; categoria: string; subcategoria: string }) => [
          r.woo_cat_id,
          { categoria: r.categoria, subcategoria: r.subcategoria },
        ])
      );
    }
  } catch {
    // DB no disponible, usar hardcoded
  }

  _dbCatMapLoaded = true;
  return _dbCatMap ?? new Map();
}

/**
 * Guarda un nuevo mapping en la tabla `woo_cat_mappings`.
 */
export async function saveCatMapping(
  wooCatId: number,
  wooCatName: string,
  categoria: string,
  subcategoria: string
): Promise<void> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    await supabase.from("woo_cat_mappings").upsert(
      {
        woo_cat_id: wooCatId,
        woo_cat_name: wooCatName,
        categoria,
        subcategoria,
      },
      { onConflict: "woo_cat_id" }
    );
    // Actualizar cache
    if (_dbCatMap) {
      _dbCatMap.set(wooCatId, { categoria, subcategoria });
    }
  } catch {
    // No crítico — el mapping se usa igual desde WOO_CAT_MAP
  }
}

// ─── Parent Chain Walking ─────────────────────────────────────────────────────

/**
 * Construye un mapa de categorías WC para poder subir por la jerarquía.
 * Acepta un array de WooCategory o una función fetch para obtenerlas.
 */
export function buildCatTree(cats: WooCategory[]): Map<number, WooCategory> {
  return new Map(cats.map((c) => [c.id, c]));
}

/**
 * Busca el mapping subiendo por la jerarquía de categorías WC.
 * Primero busca en DB, luego en hardcoded, hasta 5 niveles de profundidad.
 */
function walkParentChain(
  catId: number,
  catTree: Map<number, WooCategory>,
  dbMap: Map<number, CategoriaMapping>
): CategoriaMapping | null {
  // Buscar en el propio ID
  if (dbMap.has(catId)) return dbMap.get(catId)!;
  if (WOO_CAT_MAP[catId]) return WOO_CAT_MAP[catId];

  // Subir por la jerarquía
  let current = catTree.get(catId);
  let depth = 0;
  while (current && current.parent !== 0 && depth < 5) {
    const parentId = current.parent;
    if (dbMap.has(parentId)) return dbMap.get(parentId)!;
    if (WOO_CAT_MAP[parentId]) return WOO_CAT_MAP[parentId];
    current = catTree.get(parentId);
    depth++;
  }

  return null;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Resuelve la categoría de Esencia de Belleza para un producto de WooCommerce.
 *
 * @param wooCategories - Categorías WC del producto (id, slug, name, parent)
 * @param catTree - Árbol de categorías WC (para parent chain walking)
 * @param options - Opciones adicionales
 * @returns Mapping de categoría/subcategoría
 */
export async function resolverCategoria(
  wooCategories: { id: number; slug: string; name?: string; parent?: number }[],
  catTree?: Map<number, WooCategory>,
  options?: { productName?: string; enableSuggest?: boolean }
): Promise<CategoriaMapping> {
  const dbMap = await getDbCatMap();

  // 1. Buscar por ID directo en DB y hardcoded
  for (const cat of wooCategories) {
    if (dbMap.has(cat.id)) return dbMap.get(cat.id)!;
    if (WOO_CAT_MAP[cat.id]) return WOO_CAT_MAP[cat.id];
  }

  // 2. Parent chain walking (si tenemos el árbol)
  if (catTree) {
    for (const cat of wooCategories) {
      const mapping = walkParentChain(cat.id, catTree, dbMap);
      if (mapping) return mapping;
    }
  }

  // 3. Fallback: "peluqueria" / "peluqueria-general"
  return { categoria: "peluqueria", subcategoria: "peluqueria-general" };
}

/**
 * Versión simplificada para uso en cron/webhook sin catTree.
 * Usa solo DB + hardcoded + slug fallback.
 */
export async function resolverCategoriaSimple(
  wooCategories: { id: number; slug: string }[]
): Promise<CategoriaMapping> {
  const dbMap = await getDbCatMap();

  // 1. Buscar por ID directo
  for (const cat of wooCategories) {
    if (dbMap.has(cat.id)) return dbMap.get(cat.id)!;
    if (WOO_CAT_MAP[cat.id]) return WOO_CAT_MAP[cat.id];
  }

  // 2. Fallback por slug (para categorías padre comunes)
  const SLUG_MAP: Record<string, CategoriaMapping> = {
    peluqueria: { categoria: "peluqueria", subcategoria: "peluqueria-general" },
    productospeluqueria: { categoria: "peluqueria", subcategoria: "peluqueria-general" },
    estetica: { categoria: "estetica", subcategoria: "estetica-general" },
    "productos-estetica": { categoria: "estetica", subcategoria: "estetica-general" },
    perfumeria: { categoria: "perfumeria", subcategoria: "eau-de-parfum" },
    barberia: { categoria: "barberia", subcategoria: "cuidado-caballero" },
    tintes: { categoria: "peluqueria", subcategoria: "tintes" },
    champus: { categoria: "peluqueria", subcategoria: "champus" },
    mascarillas: { categoria: "peluqueria", subcategoria: "mascarillas" },
    acondicionadores: { categoria: "peluqueria", subcategoria: "acondicionadores" },
    tratamientos: { categoria: "peluqueria", subcategoria: "tratamientos" },
    lacas: { categoria: "peluqueria", subcategoria: "lacas" },
    espumas: { categoria: "peluqueria", subcategoria: "espumas" },
    oxigenadas: { categoria: "peluqueria", subcategoria: "oxigenadas" },
    decoloracion: { categoria: "peluqueria", subcategoria: "decoloracion" },
    permanentes: { categoria: "peluqueria", subcategoria: "permanentes" },
    "utensilios-peluqueria": { categoria: "peluqueria", subcategoria: "utensilios" },
    "aparatos-peluqueria": { categoria: "peluqueria", subcategoria: "secadores-y-planchas" },
    "utensilios-estetica": { categoria: "estetica", subcategoria: "desechables-estetica" },
  };

  for (const cat of wooCategories) {
    if (SLUG_MAP[cat.slug]) return SLUG_MAP[cat.slug];
  }

  // 3. Fallback final
  return { categoria: "peluqueria", subcategoria: "peluqueria-general" };
}
