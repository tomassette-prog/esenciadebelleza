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
  wooCategories: { id: number; slug?: string }[]
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
    if (cat.slug && SLUG_MAP[cat.slug]) return SLUG_MAP[cat.slug];
  }

  // 3. Fallback final
  return { categoria: "peluqueria", subcategoria: "peluqueria-general" };
}

// ─── Validación por nombre y descripción ──────────────────────────────────────

/**
 * Mapa de subcategorías de Esencia de Belleza → keywords de detección.
 * Basado en la estructura real del navbar (NAV_ITEMS en lib/categorias.ts).
 *
 * Cada entrada tiene:
 *   - categoria/subcategoria: destino
 *   - keywords: palabras que indican este tipo de producto
 *   - priority: mayor = más específico (se aplica primero)
 */
const SUBCATEGORIA_KEYWORDS: Array<{
  categoria: string;
  subcategoria: string;
  keywords: RegExp[];
  priority: number;
}> = [
  // ── PELUQUERÍA · Coloración ──────────────────────────────────────────────
  { categoria: "peluqueria", subcategoria: "tintes", priority: 10,
    keywords: [/TINTE/i, /COLORACI[OÓ]N/i, /COLOR PERMANENTE/i, /COLOR SEMI/i, /COLOR DEMI/i,
               /IGORA/i, /MAJI/i, /DIACOLOR/i, /NUTRISSE/i, /OLIA/i, /EXCELLENCE/i,
               /SUPREME/i, /PREFERENCE/i, /CASTING/i, /FÉRIA/i, /COLORISTA/i,
               /REFLECT/i, /INOA/i, /HOMME COLOR/i, /MEN'S COLOR/i] },
  { categoria: "peluqueria", subcategoria: "decoloracion", priority: 15,
    keywords: [/DECOLOR/i, /BLOND/i, /PLATIBLOND/i, /DECOLORANTE/i, /POWDER LIGHTENER/i,
               /BLANQUEADOR/i, /ACLARADOR/i, /PLATINUM/i, /HIGH LIFT/i] },
  { categoria: "peluqueria", subcategoria: "oxigenadas", priority: 12,
    keywords: [/OXIGENADA/i, /PER[OÓ]XIDO/i, /DEVELOPER/i, /VOL\./i, /VOLUMEN [0-9]/i,
               /ACTIVADOR/i, /EMULSI[OÓ]N/i] },
  { categoria: "peluqueria", subcategoria: "sin-amoniaco", priority: 8,
    keywords: [/SIN AMONIACO/i, /AMMONIA FREE/i, /SIN AMONÍACO/i] },

  // ── PELUQUERÍA · Cuidado Capilar ────────────────────────────────────────
  { categoria: "peluqueria", subcategoria: "champus", priority: 10,
    keywords: [/CHAMP[UÚ]/i, /SHAMPOO/i, /SHAMPO[^O]/i, /CHAMPÚ/i, /SHAMPOOING/i] },
  { categoria: "peluqueria", subcategoria: "mascarillas", priority: 8,
    keywords: [/MASCARILLA CAPILAR/i, /MASCARILLA [A-Z]* [0-9]+ML/i, /MASCARILLA [A-Z]* [0-9]+G/i,
               /HAIR MASK/i, /MASQUE CAPILAR/i, /MASCARILLA NUTRITIVA/i, /MASCARILLA REPARADORA/i,
               /MASCARILLA HIDRATANTE/i, /MASCARILLA RESTAURADORA/i] },
  { categoria: "peluqueria", subcategoria: "acondicionadores", priority: 10,
    keywords: [/ACONDICIONADOR/i, /CONDITIONER/i, /B[AÁ]LSAMO/i, /BALM CAPILAR/i,
               /LEAVE.?IN/i, /BIF[AÁ]SICO/i, /ENJUAGUE/i] },
  { categoria: "peluqueria", subcategoria: "ampollas-y-serums", priority: 12,
    keywords: [/AMPOLLA/i, /S[EÉ]RUM CAPILAR/i, /SÉRUM CAPILAR/i, /VIAL/i,
               /CONCENTRADO CAPILAR/i, /TRATAMIENTO EN AMPOLLA/i] },
  { categoria: "peluqueria", subcategoria: "tratamientos", priority: 6,
    keywords: [/TRATAMIENTO/i, /RECONSTRUCT/i, /REPARACI[OÓ]N/i, /RESTAURACI[OÓ]N/i,
               /KERATINA/i, /BOTOX CAPILAR/i, /OLAPLEX/i, /PLEX/i, /FIBER/i,
               /NUTRICI[OÓ]N INTENSIVA/i, /RECONSTRUCCIÓN/i, /REPARADOR/i,
               /ANTICA[IÍ]DA/i, /CRECIMIENTO/i, /FORTALECEDOR/i] },

  // ── PELUQUERÍA · Styling ────────────────────────────────────────────────
  { categoria: "peluqueria", subcategoria: "lacas", priority: 10,
    keywords: [/LACA/i, /HAIRSPRAY/i, /FIXADOR SPRAY/i, /SPRAY FIJADOR/i,
               /SPRAY FIJACI[OÓ]N/i, /LACQUER/i] },
  { categoria: "peluqueria", subcategoria: "espumas", priority: 10,
    keywords: [/ESPUMA/i, /MOUSSE/i, /FOAM/i] },
  { categoria: "peluqueria", subcategoria: "gominas-y-ceras", priority: 10,
    keywords: [/GOMINA/i, /CERA CAPILAR/i, /GEL FIJADOR/i, /WAX/i, /CLAY/i,
               /POMADA/i, /GEL FIJACI[OÓ]N/i, /PASTE/i, /FIBER/i, /GUM/i] },
  { categoria: "peluqueria", subcategoria: "rizos", priority: 8,
    keywords: [/RIZO/i, /CURL/i, /ANTICRESP/i, /DESENRED/i, /DEFINICI[OÓ]N/i,
               /ONDULACI[OÓ]N/i, /CREPADO/i, /AFRO/i] },
  { categoria: "peluqueria", subcategoria: "permanentes", priority: 10,
    keywords: [/PERMANENTE/i, /NEUTRALIZ/i, /DESRIZ/i, /ALISADO/i, /LISSE/i,
               /RELAX/i, /SUAVIZANTE/i] },

  // ── PELUQUERÍA · Equipos y Herramientas ─────────────────────────────────
  { categoria: "peluqueria", subcategoria: "secadores-y-planchas", priority: 12,
    keywords: [/SECADOR/i, /PLANCHAS? [A-Z]/i, /ALISADOR/i, /BABYLISS/i, /PARLUX/i,
               /GHD/i, /CLOUD NINE/i, /CORIOLISS/i, /DIFUSOR/i, /STYLING SET/i] },
  { categoria: "peluqueria", subcategoria: "maquinas-corte", priority: 15,
    keywords: [/M[AÁ]QUINA/i, /CORTAPELO/i, /WAHL/i, /OSTER/i, /ANDIS/i,
               /MOSER/i, /ELEKTRA/i, /TONDEUSE/i] },
  { categoria: "peluqueria", subcategoria: "tijeras", priority: 15,
    keywords: [/TIJERA/i, /TIJERAS/i, /FORBICE/i, /NAVAJA/i] },
  { categoria: "peluqueria", subcategoria: "cepillos-y-peines", priority: 12,
    keywords: [/CEPILLO/i, /PEINE/i, /PINCEL/i, /BROCHA/i, /RATINA/i,
               /TANGLE TEEZER/i, /DENMAN/i, /MASON PEARSON/i] },
  { categoria: "peluqueria", subcategoria: "batas-y-capas", priority: 12,
    keywords: [/BATA/i, /CAPA/i, /PEINADOR/i, /CAPELLADA/i, /GABAN/i] },
  { categoria: "peluqueria", subcategoria: "utensilios", priority: 5,
    keywords: [/BOLSA/i, /PINZA/i, /CLIP/i, /HORQUILLA/i, /GORRO/i, /RULO/i,
               /SPRAY/i, /DIFUSOR/i, /BANDEJA/i, /PORTA/i, /FUNDAS?/i,
               /QUITAMANCHA/i, /REMOVER/i, /MEZCLADOR/i, /BOTE/i] },
  { categoria: "peluqueria", subcategoria: "mobiliario", priority: 12,
    keywords: [/LAVACABEZAS/i, /SILL[OÓ]N/i, /CARRO/i, /MUEBLE/i, /ESTANTE/i,
               /ESPEJO/i, /CAMILLA/i, /RECEPCI[OÓ]N/i] },

  // ── ESTÉTICA ────────────────────────────────────────────────────────────
  { categoria: "estetica", subcategoria: "cremas-faciales", priority: 10,
    keywords: [/CREMA FACIAL/i, /CREMA [A-Z]* CARA/i, /ANTIARRUGA/i, /ANTI.?AGE/i,
               /CONTORNO/i, /HIDRATANTE FACIAL/i, /NUTRITIVA FACIAL/i] },
  { categoria: "estetica", subcategoria: "mascarillas-faciales", priority: 10,
    keywords: [/MASCARILLA FACIAL/i, /FACE MASK/i, /MASCARILLA [A-Z]* CARA/i] },
  { categoria: "estetica", subcategoria: "serums-faciales", priority: 10,
    keywords: [/S[EÉ]RUM FACIAL/i, /SÉRUM FACIAL/i, /CONTORNO DE OJOS/i,
               /S[EÉ]RUM [A-Z]* CARA/i] },
  { categoria: "estetica", subcategoria: "gel-facial", priority: 10,
    keywords: [/GEL FACIAL/i, /LIMPIEZA FACIAL/i, /T[OÓ]NICO/i, /DESMAQUILLANTE/i,
               /GEL LIMPIADOR/i, /ESPUMA LIMPIADORA/i] },
  { categoria: "estetica", subcategoria: "cremas-corporales", priority: 8,
    keywords: [/CREMA CORPORAL/i, /CREMA HIDRATANTE CORPORAL/i, /LECHE CORPORAL/i,
               /BRONCEADOR/i, /SOLAR/i, /ANTICELULITIS/i, /REAFIRMANTE/i,
               /CREMA MANOS/i, /CREMA PIES/i] },
  { categoria: "estetica", subcategoria: "aceites-corporales", priority: 10,
    keywords: [/ACEITE CORPORAL/i, /ACEITE MASAJE/i, /ACEITE ESSENCIAL/i] },
  { categoria: "estetica", subcategoria: "gel-corporal", priority: 10,
    keywords: [/GEL DE DUCHA/i, /GEL CORPORAL/i, /JAB[OÓ]N L[IÍ]QUIDO/i,
               /GEL BA[ÑN]O/i, /SHOWER GEL/i] },
  { categoria: "estetica", subcategoria: "peeling", priority: 10,
    keywords: [/PEELING/i, /EXFOLIANTE/i, /SCRUB/i] },
  { categoria: "estetica", subcategoria: "depilatorios", priority: 10,
    keywords: [/DEPIL/i, /CERA DEPIL/i, /CEPILLO DEPIL/i, /ROLL.?ON/i] },
  { categoria: "estetica", subcategoria: "ceras-depiladoras", priority: 10,
    keywords: [/CERA [A-Z]* DEPIL/i, /FUNDIDOR/i, /CALIENTE/i, /TIBIA/i] },
  { categoria: "estetica", subcategoria: "manicura-pedicura", priority: 10,
    keywords: [/MANICURA/i, /PEDICURA/i, /ESMALTE/i, /U[ÑN]AS/i, /GEL UV/i,
               /ACR[IÍ]LICO/i, /POLYGEL/i, /TIPS/i] },
  { categoria: "estetica", subcategoria: "unas", priority: 8,
    keywords: [/LIMA/i, /FRESA/i, /PINZA [A-Z]* U[ÑN]A/i, /CUT[IÍ]CULA/i] },
  { categoria: "estetica", subcategoria: "lamparas-uv", priority: 12,
    keywords: [/L[AÁ]MPARA UV/i, /L[AÁ]MPARA LED/i, /LED LAMP/i, /UV LAMP/i] },
  { categoria: "estetica", subcategoria: "maquillaje", priority: 8,
    keywords: [/MAQUILLAJE/i, /BASE [A-Z]* CARA/i, /CORRECTOR/i, /POLVOS/i,
               /RUBOR/i, /SOMBRA/i, /Delineador/i, /M[AÁ]SCARA/i, /PESTA[ÑN]A/i,
               /L[AÁ]PIZ/i, /LIPSTICK/i, /BRILLO/i, /LABIAL/i] },
  { categoria: "estetica", subcategoria: "desechables-estetica", priority: 10,
    keywords: [/DESECHABLE/i, /FILM/i, /GASAS?/i, /ALGOD[OÓ]N/i, /TOALLITAS?/i,
               /GUA[ÑN]TE/i, /FUNDAS?/i, /BOBINAS?/i, /ROLLO/i] },

  // ── BARBERÍA ────────────────────────────────────────────────────────────
  { categoria: "barberia", subcategoria: "ceras-barbero", priority: 10,
    keywords: [/CERA BARBER/i, /BARBER.*CERA/i, /CERA [A-Z]* BARBA/i] },
  { categoria: "barberia", subcategoria: "champus-barba", priority: 10,
    keywords: [/CHAMP[UÚ] BARBA/i, /SHAMPOO BARBA/i, /CHAMPÚ BARBA/i] },
  { categoria: "barberia", subcategoria: "cuidado-caballero", priority: 6,
    keywords: [/BARBER/i, /BARBA/i, /AFEITAD/i, /NAVAJA/i, /BALEA/i,
               /AFTERSHAVE/i, /LOCI[OÓ]N/i, /CREMA BARBA/i, /ACEITE BARBA/i,
               /GEL BARBA/i, /BÁLSAMO BARBA/i] },

  // ── PERFUMERÍA ──────────────────────────────────────────────────────────
  { categoria: "perfumeria", subcategoria: "eau-de-parfum", priority: 10,
    keywords: [/EAU DE PARFUM/i, /EDP[^A-Z]/i, /PERFUME/i, /FRAGRANCIA/i] },
  { categoria: "perfumeria", subcategoria: "eau-de-toilette", priority: 10,
    keywords: [/EAU DE TOILETTE/i, /EDT[^A-Z]/i] },
  { categoria: "perfumeria", subcategoria: "colonias", priority: 10,
    keywords: [/COLONIA/i, /COLOGNE/i] },
  { categoria: "perfumeria", subcategoria: "ambientadores", priority: 10,
    keywords: [/AMBIENTADOR/i, /DIFUSOR/i, /INCENSO/i, /SAHUMERIO/i] },
  { categoria: "perfumeria", subcategoria: "brumas-y-velas", priority: 10,
    keywords: [/BRUMA/i, /VELA/i, /CANDLE/i, /ROOM SPRAY/i] },
];

/**
 * Corrige la categoría asignada usando el nombre Y la descripción del producto.
 * Basado en las categorías reales de Esencia de Belleza (NAV_ITEMS).
 *
 * Llamar DESPUÉS de resolverCategoria/resolverCategoriaSimple.
 */
export function validarCategoriaPorNombre(
  nombre: string,
  categoriaActual: CategoriaMapping,
  descripcion?: string
): CategoriaMapping {
  const texto = (nombre + " " + (descripcion || "")).toUpperCase();

  // Buscar la subcategoría con mayor prioridad que matchee
  let bestMatch: CategoriaMapping | null = null;
  let bestPriority = -1;

  for (const sub of SUBCATEGORIA_KEYWORDS) {
    // Skip si ya está en la categoría correcta
    if (categoriaActual.categoria === sub.categoria && categoriaActual.subcategoria === sub.subcategoria) {
      return categoriaActual;
    }

    // Solo aplicar si la prioridad es mayor que el match actual
    if (sub.priority <= bestPriority) continue;

    // Verificar si algún keyword matchea
    for (const kw of sub.keywords) {
      if (kw.test(texto)) {
        bestMatch = { categoria: sub.categoria, subcategoria: sub.subcategoria };
        bestPriority = sub.priority;
        break;
      }
    }
  }

  return bestMatch || categoriaActual;
}
