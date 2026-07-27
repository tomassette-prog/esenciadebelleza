"use server";

import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { WOO_CAT_MAP } from "@/lib/categorias";
import { slugifyCategoria } from "@/lib/seo";
import { suggestCategory } from "@/lib/category-suggester";

const ADMIN_EMAILS = ["ziarresamot@gmail.com"];
const WOO_URL  = process.env.WOO_URL!;
const CK       = process.env.WOO_CONSUMER_KEY!;
const CS       = process.env.WOO_CONSUMER_SECRET!;

// Cache DB mappings for the duration of a single server action execution
let _dbCatMap: Map<number, { categoria: string; subcategoria: string }> | null = null;

async function getDbCatMap(supa: ReturnType<typeof adminClient>): Promise<Map<number, { categoria: string; subcategoria: string }>> {
  if (_dbCatMap) return _dbCatMap;
  try {
    const { data } = await supa.from("woo_cat_mappings").select("woo_cat_id, categoria, subcategoria");
    if (data && data.length > 0) {
      _dbCatMap = new Map(data.map((r: { woo_cat_id: number; categoria: string; subcategoria: string }) => [r.woo_cat_id, { categoria: r.categoria, subcategoria: r.subcategoria }]));
      return _dbCatMap;
    }
  } catch { /* fallback to hardcoded */ }
  _dbCatMap = new Map(Object.entries(WOO_CAT_MAP).map(([k, v]) => [Number(k), v]));
  return _dbCatMap;
}


function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function verificarAdmin() {
  try {
    const cookieStore = await cookies();
    const cookieName = `sb-yjanobsfzcwpusynvlun-auth-token`;
    let tokenValue = cookieStore.get(cookieName)?.value;
    if (!tokenValue) {
      let combined = "";
      for (let i = 0; i < 5; i++) {
        const chunk = cookieStore.get(`${cookieName}.${i}`)?.value;
        if (!chunk) break;
        combined += chunk;
      }
      if (combined) tokenValue = combined;
    }
    if (tokenValue) {
      const parsed = JSON.parse(tokenValue);
      const payload = JSON.parse(Buffer.from(parsed.access_token.split(".")[1], "base64url").toString());
      if (payload.sub && payload.exp * 1000 > Date.now() && ADMIN_EMAILS.includes(payload.email)) return;
    }
  } catch { /* ignorar */ }
  throw new Error("No autorizado");
}

async function fetchWoo(path: string) {
  const auth = Buffer.from(`${CK}:${CS}`).toString("base64");
  const res = await fetch(`${WOO_URL}/wp-json/wc/v3${path}`, {
    headers: { Authorization: `Basic ${auth}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`WooCommerce ${res.status}`);
  return res.json();
}

function slugify(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function resolverCategoria(cats: { id: number }[], catMap: Map<number, { categoria: string; subcategoria: string }>) {
  for (const cat of cats) {
    const mapped = catMap.get(cat.id);
    if (mapped) return mapped;
  }
  return { categoria: "peluqueria", subcategoria: "peluqueria-general" };
}

// ─── Brand extraction helpers ─────────────────────────────────────────────────

const DESCRIPTOR_BLOCKLIST = new Set([
  "de", "del", "para", "con", "y", "e", "el", "la", "los", "las",
  "un", "una", "por", "en", "a",
]);

// Marcas conocidas del sector (ordenadas de más largo a más corto para matching)
const KNOWN_BRANDS = [
  "L'Oréal","Loreal","Wella","Fanola","Schwarzkopf","Goldwell","Revlon",
  "Kérastase","Kerastase","Matrix","Redken","Joico","Olaplex","Alfaparf",
  "Balmain","Montibello","Risfort","Salerm","Celine","Periche","Keyra",
  "Exitenn","Tahe","Hipertin","Liheto","Glossco","Yunsey","Valquer",
  "Keen Strok","Hairtalk","Keler","Lendan","Arual","Vis Plantis","Dr. Sante",
  "Novon","Hey Joe","Kuul","Karseell","Cantu","Candelahn","Coiffer","Don Algodon",
  "Eurostil","Babyliss","Parlux","GHD","Cloud Nine","Corioliss","Ikoo",
  "Tangle Teezer","Denman","Mason Pearson","Acca Kappa","Moroccanoil",
  "Kevin Murphy","Davines","Tigi","Sebastian","Nioxin","Paul Mitchell",
  "Aveda","KMS","Tec Italy","Lakme","Nevo","Surface","Sexy Hair",
  "Kenra","Rusk","Scruples","Pravana","Rusk","Zotos","ISO",
  "BaByliss PRO","Ermila","Moser","Wahl","Andis","Oster","Heidi",
  "Jaguar","Kasho","Mizutaki","Joewell","Kamisori","Saki",
].sort((a, b) => b.length - a.length);

function extractBrandName(productName: string): string {
  const nameLower = productName.toLowerCase();
  
  // 1. Buscar marca conocida en el nombre del producto
  for (const brand of KNOWN_BRANDS) {
    if (nameLower.includes(brand.toLowerCase())) {
      return brand;
    }
  }
  
  // 2. Fallback: tomar las primeras 1-2 palabras
  const words = productName.trim().replace(/\s+/g, " ").split(" ");
  if (words.length === 0) return productName.trim();
  const first = words[0];
  if (words.length >= 2) {
    const second = words[1];
    if (
      !DESCRIPTOR_BLOCKLIST.has(second.toLowerCase()) &&
      second.length <= 12 &&
      /^[A-ZÁÉÍÓÚÑÜ'"]/.test(second)
    ) {
      return `${first} ${second}`;
    }
  }
  return first;
}

// ─── Brand resolution (woo_brand_mappings) ─────────────────────────────────────

async function getBrandMappingsCache(
  supa: ReturnType<typeof adminClient>
): Promise<Map<string, { marca_id: string | null; is_new_brand: boolean }>> {
  const { data } = await supa.from("woo_brand_mappings").select("woo_brand_name, marca_id, is_new_brand");
  return new Map(
    (data ?? []).map((r: { woo_brand_name: string; marca_id: string | null; is_new_brand: boolean }) => [
      r.woo_brand_name,
      { marca_id: r.marca_id, is_new_brand: r.is_new_brand },
    ])
  );
}

async function resolveBrandFromWc(
  supa: ReturnType<typeof adminClient>,
  wcProductName: string,
  wcAttributes: { name: string; options: string[] }[],
  brandMappingsCache: Map<string, { marca_id: string | null; is_new_brand: boolean }>
): Promise<{ marcaId: string | null; status: "resolved" | "pending" | "new_confirmed"; brandName: string }> {
  void supa; // reservado para futuras consultas directas a DB si el cache no basta
  const attrBrand = wcAttributes?.find(a => a.name.toLowerCase().includes("marca"))?.options?.[0];
  const brandName = (attrBrand?.trim() || extractBrandName(wcProductName)).trim();

  const mapping = brandMappingsCache.get(brandName);
  if (mapping) {
    if (mapping.marca_id) return { marcaId: mapping.marca_id, status: "resolved", brandName };
    if (mapping.is_new_brand) return { marcaId: null, status: "new_confirmed", brandName };
  }
  return { marcaId: null, status: "pending", brandName };
}

export interface ProductoDiff {
  slug: string;
  nombre: string;
  tipo: "nuevo" | "modificado";
  wooId: number;
  wooCategories: number[];
  cambios?: Record<string, { woo: string | null; actual: string | null }>;
  precioCambio?: { woo: number; actual: number };
  brandResolution?: {
    brandName: string;
    status: "resolved" | "pending" | "new_confirmed";
    marcaId?: string | null;
  };
}

export interface UnmappedCategory {
  wooCatId: number;
  wooCatName: string;
  suggestedCategoria: string;
  suggestedSubcategoria: string;
  confidence: "high" | "medium" | "low";
}

export interface MarcaResolution {
  wooBrandName: string;
  status: "resolved" | "pending" | "new_confirmed";
  marcaId?: string | null;
  marcaNombre?: string;
  productCount: number;
  productNames: string[];
}

export interface DiffGaps {
  newBrands: MarcaResolution[];
  unmappedCategories: UnmappedCategory[];
  pendingBrands: MarcaResolution[];
}

export interface ReviewGroup {
  groupKey: string;
  suggestedCategoria: string;
  suggestedSubcategoria: string;
  confidence: "high" | "medium" | "low";
  products: Array<{ slug: string; nombre: string; wooId: number; brandName: string }>;
  sourceWooCatIds: number[];
}

export interface ReviewPayload {
  approvedGroups: Array<{
    slugsConId: Array<{ slug: string; wooId: number }>;
    categoria: string;
    subcategoria: string;
  }>;
  brandMappings?: Array<{
    wooBrandName: string;
    marcaId: string | null;
    isNewBrand: boolean;
  }>;
}

export interface MarcaExistente {
  id: string;
  nombre: string;
}

export async function listarMarcasExistentes(): Promise<{ marcas: MarcaExistente[]; error?: string }> {
  try {
    await verificarAdmin();
  } catch {
    return { marcas: [], error: "No autorizado" };
  }
  try {
    const supa = adminClient();
    const { data } = await supa.from("marcas").select("id, nombre").order("nombre");
    return { marcas: (data ?? []) as MarcaExistente[] };
  } catch (e) {
    return { marcas: [], error: String(e) };
  }
}

export interface SmartApplyResult {
  ok: number;
  brandsCreated: string[];
  seoTriggered: string[];
  notFound: string[];
  error?: string;
}

export async function calcularDiff(): Promise<{
  nuevos: ProductoDiff[];
  modificados: ProductoDiff[];
  iguales: number;
  gaps: DiffGaps;
  snapshotExists?: boolean;
  error?: string;
}> {
  try {
    await verificarAdmin();
  } catch {
    return { nuevos: [], modificados: [], iguales: 0, gaps: { newBrands: [], unmappedCategories: [], pendingBrands: [] }, error: "No autorizado" };
  }

  try {
    // 1. Descargar WooCommerce (paginado)
    const wooProductos: {
      id: number; name: string; slug: string; type: string;
      description: string; short_description: string;
      sku: string;
      price: string; regular_price: string; sale_price: string;
      images: { src: string }[];
      categories: { id: number; name: string }[];
      attributes: { name: string; options: string[] }[];
    }[] = [];
    let page = 1;
    while (true) {
      const batch = await fetchWoo(`/products?status=publish&per_page=100&page=${page}`);
      if (!Array.isArray(batch) || batch.length === 0) break;
      wooProductos.push(...batch);
      if (batch.length < 100) break;
      page++;
      await new Promise(r => setTimeout(r, 500)); // Delay para evitar 503 de WC
    }

    // 2. Cargar Supabase (productos + variaciones)
    const supa = adminClient();
    const supaMap = new Map<string, {
      id: string;
      nombre: string; categoria: string; subcategoria: string | null;
      imagen_principal_url: string | null; descripcion_general: string | null;
      woo_id?: number | null;
    }>();
    const supaMapByWooId = new Map<number, string>();  // woo_id -> slug
    
    let offset = 0;
    while (true) {
      const { data } = await supa
        .from("productos_padre")
        .select("id, slug, nombre, categoria, subcategoria, imagen_principal_url, descripcion_general, woo_id")
        .range(offset, offset + 999);
      if (!data || data.length === 0) break;
      for (const r of data) {
        supaMap.set(r.slug, r);
        if (r.woo_id) supaMapByWooId.set(r.woo_id, r.slug);
      }
      if (data.length < 1000) break;
      offset += 1000;
    }

    // 3. Cargar snapshot anterior (WC vs snapshot, NO WC vs Supabase)
    const snapshotMap = new Map<number, { woo_id: number; slug: string; precio: number }>();
    offset = 0;
    while (true) {
      const { data } = await supa.from("woo_snapshot").select("woo_id, slug, precio").range(offset, offset + 999);
      if (!data || data.length === 0) break;
      for (const r of data) snapshotMap.set(r.woo_id, r);
      if (data.length < 1000) break;
      offset += 1000;
    }

    const tieneSnapshot = snapshotMap.size > 0;

    // 4. Comparar WC actual vs Esencia (para nuevos) y vs snapshot (para precios)
    const catMap = await getDbCatMap(supa);
    const brandMappingsCache = await getBrandMappingsCache(supa);
    const nuevos: ProductoDiff[] = [];
    const modificados: ProductoDiff[] = [];
    let iguales = 0;

    for (const p of wooProductos) {
      const slug = p.slug || slugify(p.name);
      const wooPrice = parseFloat(p.regular_price || p.price) || 0;
      const snap = snapshotMap.get(p.id);

      // ── Paso 1: ¿Existe en Esencia? (por woo_id → slug → nombre) ──────
      let slugEnDB: string | undefined;
      let existingInEsencia = false;

      // Por woo_id
      if (p.id && supaMapByWooId.has(p.id)) {
        slugEnDB = supaMapByWooId.get(p.id);
        existingInEsencia = true;
      }
      // Por slug
      if (!existingInEsencia && supaMap.has(slug)) {
        slugEnDB = slug;
        existingInEsencia = true;
      }
      // Por nombre normalizado
      if (!existingInEsencia) {
        const normName = p.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
        for (const [, info] of supaMap) {
          const infoName = (info as any).nombre?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
          if (infoName === normName) {
            slugEnDB = (info as any).slug;
            existingInEsencia = true;
            // Vincular woo_id automáticamente
            supaMapByWooId.set(p.id, slugEnDB!);
            break;
          }
        }
      }

      // ── Paso 2: Clasificar ─────────────────────────────────────────────
      if (!existingInEsencia) {
        // NO existe en Esencia → producto genuinamente nuevo
        const brandResolution = await resolveBrandFromWc(supa, p.name, p.attributes ?? [], brandMappingsCache);
        nuevos.push({
          slug, nombre: p.name, tipo: "nuevo", wooId: p.id, wooCategories: p.categories.map(c => c.id),
          brandResolution,
        });
        continue;
      }

      // Existe en Esencia → comparar precio con snapshot
      if (snap && wooPrice !== snap.precio && wooPrice > 0) {
        modificados.push({
          slug: slugEnDB!,
          nombre: p.name,
          tipo: "modificado",
          wooId: p.id,
          wooCategories: p.categories.map(c => c.id),
          precioCambio: { woo: wooPrice, actual: snap.precio }
        });
      } else {
        iguales++;
      }
    }

    // 5. Detectar gaps: marcas pendientes de aprobación y categorías sin mapear
    const brandGroups = new Map<string, MarcaResolution>();
    for (const nuevo of nuevos) {
      const br = nuevo.brandResolution;
      if (!br || br.status === "resolved") continue;
      const key = `${br.status}:${br.brandName}`;
      if (!brandGroups.has(key)) {
        brandGroups.set(key, {
          wooBrandName: br.brandName,
          status: br.status,
          marcaId: br.marcaId,
          productCount: 0,
          productNames: [],
        });
      }
      const g = brandGroups.get(key)!;
      g.productCount++;
      if (g.productNames.length < 3) g.productNames.push(nuevo.nombre);
    }
    const newBrands = [...brandGroups.values()].filter(b => b.status === "new_confirmed");
    const pendingBrands = [...brandGroups.values()].filter(b => b.status === "pending");

    // Detect unmapped using the same catMap
    const seenCatIds = new Set<number>();
    const unmappedCategories: UnmappedCategory[] = [];
    for (const nuevo of nuevos) {
      for (const catId of nuevo.wooCategories) {
        if (catMap.has(catId) || seenCatIds.has(catId)) continue;
        seenCatIds.add(catId);
        const wooP = wooProductos.find(p => p.id === nuevo.wooId);
        const cat = wooP?.categories.find(c => c.id === catId);
        const wooCatName = cat?.name ?? String(catId);
        const suggestion = await suggestCategory(wooCatName, nuevo.nombre);
        unmappedCategories.push({
          wooCatId: catId,
          wooCatName,
          suggestedCategoria: suggestion.categoria,
          suggestedSubcategoria: suggestion.subcategoria,
          confidence: suggestion.confidence,
        });
      }
    }

    const gaps: DiffGaps = { newBrands, unmappedCategories, pendingBrands };

    return { nuevos, modificados, iguales, gaps, snapshotExists: tieneSnapshot };
  } catch (e) {
    return { nuevos: [], modificados: [], iguales: 0, gaps: { newBrands: [], unmappedCategories: [], pendingBrands: [] }, error: String(e) };
  }
}

export async function aplicarCambios(slugsConId: Array<{ slug: string; wooId: number }>): Promise<{
  ok: number;
  noEncontrados: string[];
  error?: string;
}> {
  try {
    await verificarAdmin();
  } catch {
    return { ok: 0, noEncontrados: [], error: "No autorizado" };
  }

  if (!slugsConId.length) return { ok: 0, noEncontrados: [] };

  try {
    type WooProducto = {
      id: number; name: string; slug: string; type: string; variations: number[];
      description: string; short_description: string; sku: string;
      price: string; regular_price: string; sale_price: string;
      stock_quantity: number | null; stock_status: string;
      images: { src: string }[];
      categories: { id: number; name: string }[];
      attributes: { name: string; options: string[] }[];
    };

    // Buscar por ID de WooCommerce (lookup directo, siempre fiable)
    const PARALELO = 20;
    const seleccionados: WooProducto[] = [];
    const noEncontrados: string[] = [];
    for (let i = 0; i < slugsConId.length; i += PARALELO) {
      const lote = slugsConId.slice(i, i + PARALELO);
      const resultados = await Promise.all(
        lote.map(({ slug, wooId }) =>
          (fetchWoo(`/products/${wooId}`) as Promise<WooProducto>)
            .then(p => ({ ok: true as const, p }))
            .catch(() => ({ ok: false as const, slug }))
        )
      );
      for (const r of resultados) {
        if (r.ok) seleccionados.push(r.p);
        else noEncontrados.push(r.slug);
      }
    }

    const supa = adminClient();
    const catMap = await getDbCatMap(supa);

    // Obtener slugs existentes para preservar flags y obtener producto_id
    const slugsExistentes = seleccionados.map(p => p.slug || slugify(p.name));
    const { data: existentes } = await supa
      .from("productos_padre")
      .select("id, slug, activo, destacado, nuevo")
      .in("slug", slugsExistentes);
    const existMap = new Map((existentes ?? []).map(e => [e.slug, e]));

    // Separar productos nuevos de existentes para actualizar woo_id
    const nuevosProds: any[] = [];
    const actualizarProds: any[] = [];

    for (const p of seleccionados) {
      const slug = p.slug || slugify(p.name);
      const exists = existMap.get(slug);
      
      if (!exists) {
        // Nuevo producto — guardar con woo_id
        nuevosProds.push({
          nombre: p.name.trim(),
          slug,
          woo_id: p.id,
          activo: false,
          destacado: false,
          nuevo: false,
        });
      } else {
        // Existente — asegurar que tiene woo_id guardado
        if (exists.id) {
          actualizarProds.push({
            id: exists.id,
            woo_id: p.id,
          });
        }
      }
    }

    // Insertar nuevos
    if (nuevosProds.length > 0) {
      await supa.from("productos_padre").insert(nuevosProds);
    }

    // Actualizar woo_id en existentes
    for (const prod of actualizarProds) {
      await supa.from("productos_padre").update({ woo_id: prod.woo_id }).eq("id", prod.id);
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Solo actualizar PRECIOS, no tocar otros campos del producto
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    // Cargar multiplicador para precio_b2b
    let precioMultiplicador = 0.75;
    try {
      const { data: configMult } = await supa.from("config_tienda")
        .select("valor").eq("clave", "precio_multiplicador_b2b").single();
      if (configMult?.valor) precioMultiplicador = parseFloat(configMult.valor) || 0.75;
    } catch { /* usar fallback */ }

    let actualizados = 0;

    // Actualizar variaciones para productos simples (SOLO actualizar precio)
    for (const p of seleccionados) {
      if (p.type !== "simple" || !p.sku) continue;
      const { data: padre } = await supa.from("productos_padre").select("id").eq("slug", p.slug || slugify(p.name)).single();
      if (!padre) continue;
      const precioRegular = parseFloat(p.regular_price || p.price) || 0;
      const precioVenta   = parseFloat(p.sale_price) || 0;
      
      const { data: existing } = await supa
        .from("productos_variaciones")
        .select("id")
        .eq("sku", p.sku)
        .single();
      
      if (existing) {
        const { error } = await supa
          .from("productos_variaciones")
          .update({
            precio_b2c: precioRegular,
            precio_b2b: parseFloat((precioRegular * precioMultiplicador).toFixed(2)),
            precio_comparar: precioVenta > 0 && precioVenta < precioRegular ? precioRegular : null,
          })
          .eq("sku", p.sku);
        if (!error) actualizados++;
      } else {
        const { error } = await supa
          .from("productos_variaciones")
          .insert({
            producto_padre_id: padre.id,
            sku: p.sku,
            nombre_variacion: "Unidad",
            precio_b2c: precioRegular,
            precio_b2b: parseFloat((precioRegular * precioMultiplicador).toFixed(2)),
            precio_comparar: precioVenta > 0 && precioVenta < precioRegular ? precioRegular : null,
            stock: p.stock_quantity ?? 0,
            activa: p.stock_status !== "outofstock",
            imagen_url: p.images[0]?.src ?? null,
          });
        if (!error) actualizados++;
      }
    }

    return { ok: actualizados, noEncontrados };
  } catch (e) {
    return { ok: 0, noEncontrados: [], error: String(e) };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// publicarAprobados — Smart Import review apply
// ─────────────────────────────────────────────────────────────────────────────

export async function publicarAprobados(payload: ReviewPayload): Promise<SmartApplyResult> {
  const empty: SmartApplyResult = { ok: 0, brandsCreated: [], seoTriggered: [], notFound: [] };
  try {
    await verificarAdmin();
  } catch {
    return { ...empty, error: "No autorizado" };
  }

  if (!payload.approvedGroups.length && !payload.brandMappings?.length) return empty;

  try {
    const supa = adminClient();

    // Step B — fetch products from WooCommerce by ID
    type WooProducto = {
      id: number; name: string; slug: string; type: string;
      description: string; short_description: string; sku: string;
      price: string; regular_price: string; sale_price: string;
      stock_quantity: number | null; stock_status: string;
      images: { src: string }[];
      categories: { id: number; name: string }[];
      attributes: { name: string; options: string[] }[];
    };

    function brandNameForProduct(p: WooProducto): string {
      const attrBrand = p.attributes?.find(a => a.name.toLowerCase().includes("marca"))?.options?.[0];
      return (attrBrand?.trim() || extractBrandName(p.name)).trim();
    }

    const allSlugsConId = payload.approvedGroups.flatMap(g => g.slugsConId);
    const PARALELO = 20;
    const fetched: WooProducto[] = [];
    const notFound: string[] = [];

    for (let i = 0; i < allSlugsConId.length; i += PARALELO) {
      const lote = allSlugsConId.slice(i, i + PARALELO);
      const results = await Promise.all(
        lote.map(({ slug, wooId }) =>
          (fetchWoo(`/products/${wooId}`) as Promise<WooProducto>)
            .then(p => ({ ok: true as const, p }))
            .catch(() => ({ ok: false as const, slug }))
        )
      );
      for (const r of results) {
        if (r.ok) fetched.push(r.p);
        else notFound.push(r.slug);
      }
    }

    // Step C — process ONLY admin-approved brand decisions. NEVER auto-create brands.
    const { data: marcasExisting } = await supa.from("marcas").select("id, slug, nombre");
    const marcaSlugToId = new Map<string, string>(
      (marcasExisting ?? []).map((m: { id: string; slug: string }) => [m.slug, m.id])
    );

    const brandMappingsCache = await getBrandMappingsCache(supa);
    const resolvedBrandMap = new Map<string, string | null>(
      [...brandMappingsCache.entries()].map(([name, m]) => [name, m.marca_id])
    );

    const brandsCreated: string[] = [];
    const brandMappingUpserts: Array<{ woo_brand_name: string; marca_id: string | null; is_new_brand: boolean }> = [];

    for (const bm of payload.brandMappings ?? []) {
      if (bm.isNewBrand) {
        const brandSlug = slugify(bm.wooBrandName);
        let marcaId = marcaSlugToId.get(brandSlug);
        if (!marcaId) {
          const { data: inserted, error: insertErr } = await supa
            .from("marcas")
            .insert({ nombre: bm.wooBrandName, slug: brandSlug, logo_url: null })
            .select("id")
            .single();
          if (insertErr || !inserted) continue;
          marcaId = inserted.id as string;
          marcaSlugToId.set(brandSlug, marcaId);
          brandsCreated.push(bm.wooBrandName);
        }
        resolvedBrandMap.set(bm.wooBrandName, marcaId);
        brandMappingUpserts.push({ woo_brand_name: bm.wooBrandName, marca_id: marcaId, is_new_brand: true });
      } else if (bm.marcaId) {
        resolvedBrandMap.set(bm.wooBrandName, bm.marcaId);
        brandMappingUpserts.push({ woo_brand_name: bm.wooBrandName, marca_id: bm.marcaId, is_new_brand: false });
      }
    }

    if (brandMappingUpserts.length > 0) {
      await supa.from("woo_brand_mappings")
        .upsert(brandMappingUpserts, { onConflict: "woo_brand_name" });
    }

    // Step D — build category override map, save to DB, and upsert rows
    const slugToCat = new Map<string, { categoria: string; subcategoria: string }>();
    for (const group of payload.approvedGroups) {
      for (const { slug } of group.slugsConId) {
        slugToCat.set(slug, { categoria: group.categoria, subcategoria: group.subcategoria });
      }
    }

    // Persist approved WooCommerce category mappings to DB for future imports
    if (payload.approvedGroups.length > 0) {
      const newMappings: Array<{ woo_cat_id: number; woo_cat_name: string; categoria: string; subcategoria: string }> = [];
      for (const group of payload.approvedGroups) {
        for (const wooCatId of group.slugsConId
          .flatMap(s => fetched.find(p => (p.slug || slugify(p.name)) === s.slug)?.categories ?? [])
          .map(c => c.id)
          .filter((id, i, arr) => arr.indexOf(id) === i)) {
          newMappings.push({
            woo_cat_id: wooCatId,
            woo_cat_name: fetched.find(p =>
              p.categories.some(c => c.id === wooCatId)
            )?.categories.find(c => c.id === wooCatId)?.name ?? String(wooCatId),
            categoria: group.categoria,
            subcategoria: group.subcategoria,
          });
        }
      }
      if (newMappings.length > 0) {
        await supa.from("woo_cat_mappings")
          .upsert(newMappings, { onConflict: "woo_cat_id" });
        // Reset cache so next calcularDiff sees new mappings
        _dbCatMap = null;
      }
    }

    const publishedSlugs = fetched.map(p => p.slug || slugify(p.name));
    const { data: existentes } = await supa.from("productos_padre")
      .select("id, slug, nombre, destacado, nuevo, woo_id")
      .in("slug", publishedSlugs);
    const existMap = new Map((existentes ?? []).map(e => [e.slug, e]));

    // También buscar por nombre normalizado como fallback anti-duplicado
    const existByNombre = new Map<string, { slug: string; id: string }>();
    const { data: todosProductos } = await supa.from("productos_padre")
      .select("id, slug, nombre")
      .range(0, 4999); // cargar todos para matching por nombre
    for (const r of (todosProductos ?? [])) {
      const key = r.nombre.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
      existByNombre.set(key, { slug: r.slug, id: r.id });
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // IMPORTANTE: Para productos ya existentes, solo actualizar PRECIOS
    // No actualizar nombre, categoría, descripción, etc.
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    const suffix = " | Esencia de Belleza";
    const maxNombre = 60 - suffix.length;

    const rowsNuevos: any[] = [];
    const rowsActualizar: any[] = [];
    
    for (const p of fetched) {
      const slug = p.slug || slugify(p.name);
      const cat = slugToCat.get(slug) ?? resolverCategoria(p.categories, new Map(Object.entries(WOO_CAT_MAP).map(([k,v]) => [Number(k),v])));
      let ex = existMap.get(slug);

      // Fallback anti-duplicado: si no existe por slug, buscar por nombre
      if (!ex) {
        const normName = p.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
        const foundByName = existByNombre.get(normName);
        if (foundByName) {
          // Existe en Esencia con otro slug → vincular woo_id y tratar como existente
          ex = { slug: foundByName.slug, id: foundByName.id } as any;
        }
      }

      const marcaId = resolvedBrandMap.get(brandNameForProduct(p)) ?? null;
      const nombreTruncado = p.name.trim().slice(0, maxNombre);
      
      // Si es nuevo (no existe en Esencia), crear con todos los campos
      if (!ex) {
        rowsNuevos.push({
          nombre: p.name.trim(),
          slug,
          woo_id: p.id,
          categoria: cat.categoria,
          subcategoria: cat.subcategoria,
          descripcion_general: p.description || p.short_description || null,
          imagen_principal_url: p.images[0]?.src ?? null,
          seo_title: `${nombreTruncado}${suffix}`,
          seo_description: `Compra ${p.name.trim()} al mejor precio. Envío 24-48h a toda España.`,
          activo: true,
          destacado: false,
          nuevo: false,
          marca_id: marcaId ?? null,
        });
      } else {
        // Si ya existe, guardar marca_id y woo_id para actualizar después
        rowsActualizar.push({
          slug,
          marca_id: marcaId,
          woo_id: p.id,
        });
      }
    }

    // Insertar nuevos productos
    if (rowsNuevos.length > 0) {
      const { error: insertError } = await supa.from("productos_padre")
        .insert(rowsNuevos);
      if (insertError && insertError.code !== "23505") {  // Ignorar duplicate key errors
        return { ...empty, notFound, error: insertError.message };
      }
    }

    // Actualizar marca_id y woo_id en existentes
    for (const row of rowsActualizar) {
      const updates: any = {};
      if (row.marca_id) updates.marca_id = row.marca_id;
      if (row.woo_id) updates.woo_id = row.woo_id;
      if (Object.keys(updates).length > 0) {
        await supa.from("productos_padre")
          .update(updates)
          .eq("slug", row.slug);
      }
    }

    // Step E — upsert variaciones (SOLO actualizar precio para existentes, crear para nuevos)
    // Cargar multiplicador de config_tienda para calcular precio_b2b
    let precioMultiplicador = 0.75; // fallback
    try {
      const { data: configMult } = await supa.from("config_tienda")
        .select("valor").eq("clave", "precio_multiplicador_b2b").single();
      if (configMult?.valor) precioMultiplicador = parseFloat(configMult.valor) || 0.75;
    } catch { /* usar fallback */ }

    for (const p of fetched) {
      if (p.type !== "simple" || !p.sku) continue;
      const { data: padre } = await supa.from("productos_padre")
        .select("id").eq("slug", p.slug || slugify(p.name)).single();
      if (!padre) continue;
      const precioRegular = parseFloat(p.regular_price || p.price) || 0;
      const precioVenta   = parseFloat(p.sale_price) || 0;
      
      // Primero intentar UPDATE (para productos existentes) — solo actualizar precio
      const { data: existing } = await supa
        .from("productos_variaciones")
        .select("id")
        .eq("sku", p.sku)
        .single();
      
      if (existing) {
        // Producto existente — actualizar precio
        await supa
          .from("productos_variaciones")
          .update({
            precio_b2c: precioRegular,
            precio_b2b: parseFloat((precioRegular * precioMultiplicador).toFixed(2)),
            precio_comparar: precioVenta > 0 && precioVenta < precioRegular ? precioRegular : null,
          })
          .eq("sku", p.sku);
      } else {
        // Producto nuevo — insertar con todos los campos
        await supa
          .from("productos_variaciones")
          .insert({
            producto_padre_id: padre.id,
            sku: p.sku,
            nombre_variacion: "Unidad",
            precio_b2c: precioRegular,
            precio_b2b: parseFloat((precioRegular * precioMultiplicador).toFixed(2)),
            precio_comparar: precioVenta > 0 && precioVenta < precioRegular ? precioRegular : null,
            stock: p.stock_quantity ?? 0,
            activa: p.stock_status !== "outofstock",
            imagen_url: p.images[0]?.src ?? null,
          });
      }
    }

    // Step F — trigger SEO for products without texto_enriquecido_seo
    const { generarSeoProducto } = await import("@/lib/seo-generator");
    const { data: needsSeo } = await supa.from("productos_padre")
      .select("slug, nombre, categoria, subcategoria")
      .in("slug", publishedSlugs)
      .or("texto_enriquecido_seo.is.null,texto_enriquecido_seo.eq.");

    const seoResults = await Promise.allSettled(
      (needsSeo ?? []).map(async (row: { slug: string; nombre: string; categoria: string; subcategoria: string }) => {
        const seoOutput = generarSeoProducto({
          nombre: row.nombre,
          marca: null,
          categoria: row.categoria,
          subcategoria: row.subcategoria,
          descripcion: null,
        });
        await supa.from("productos_padre").update({
          seo_title: seoOutput.seo_title,
          seo_description: seoOutput.seo_description,
          texto_enriquecido_seo: seoOutput.texto_enriquecido_seo,
        }).eq("slug", row.slug);
        return row.slug;
      })
    );

    const seoTriggered = seoResults
      .filter((r): r is PromiseFulfilledResult<string> => r.status === "fulfilled")
      .map(r => r.value);

    // Guardar snapshot tras importación exitosa
    try {
      const snapResult = await guardarSnapshot();
      if (snapResult.error) console.warn("[WARN] Snapshot guardado parcialmente:", snapResult.error);
    } catch (e) {
      console.warn("[WARN] No se pudo guardar snapshot:", e);
    }

    return { ok: rowsNuevos.length + rowsActualizar.length, brandsCreated, seoTriggered, notFound };
  } catch (e) {
    return { ...empty, error: String(e) };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// backfillWooId — Vincula productos existentes con sus IDs de WooCommerce
// Estrategia rápida: slug + nombre (sin descargar variaciones)
// ─────────────────────────────────────────────────────────────────────────────

let _backfillProgress: { phase: string; current: number; total: number; done: boolean; result?: BackfillResult } | null = null;

type BackfillResult = {
  ok: number; bySku: number; bySlug: number; byName: number;
  unmatched: number; unmatchedList: Array<{ id: number; name: string; slug: string }>; error?: string;
};

export async function getBackfillProgress() {
  // Leer de la tabla de progreso (persiste entre invocaciones de Vercel)
  try {
    const supa = adminClient();
    const { data } = await supa.from("backfill_progress").select("payload").eq("id", 1).single();
    if (data?.payload) return JSON.parse(data.payload);
  } catch { /* tabla no existe o error */ }
  return _backfillProgress ?? { phase: "idle", current: 0, total: 0, done: true };
}

async function _saveProgressToDb(progress: any) {
  try {
    const supa = adminClient();
    await supa.from("backfill_progress").upsert({ id: 1, payload: JSON.stringify(progress) }, { onConflict: "id" });
  } catch { /* ignore */ }
}

function setBfProgress(phase: string, current: number, total: number) {
  _backfillProgress = { phase, current, total, done: false };
  _saveProgressToDb(_backfillProgress).catch(() => {});
}

export async function backfillWooId(): Promise<BackfillResult> {
  try { await verificarAdmin(); } catch {
    return { ok: 0, bySku: 0, bySlug: 0, byName: 0, unmatched: 0, unmatchedList: [], error: "No autorizado" };
  }
  try {
    const supa = adminClient();

    // 1. Fetch WC products (solo datos básicos, sin variaciones)
    setBfProgress("Descargando productos de WooCommerce…", 0, 0);
    const wooProducts: { id: number; name: string; slug: string; sku: string }[] = [];
    let page = 1;
    while (true) {
      const batch = await fetchWoo(`/products?status=publish&per_page=100&page=${page}`) as { id: number; name: string; slug: string; sku: string }[];
      if (!Array.isArray(batch) || batch.length === 0) break;
      wooProducts.push(...batch);
      setBfProgress(`Descargando WC… ${wooProducts.length} productos`, wooProducts.length, 0);
      if (batch.length < 100) break;
      page++;
      await new Promise(r => setTimeout(r, 500)); // Delay para evitar 503
    }

    // 2. Cargar productos sin woo_id
    setBfProgress("Cargando catálogo de Esencia…", 0, 0);
    const sinWooId: { id: string; nombre: string; slug: string }[] = [];
    let offset = 0;
    while (true) {
      const { data } = await supa.from("productos_padre").select("id, nombre, slug, woo_id").range(offset, offset + 999);
      if (!data || data.length === 0) break;
      for (const r of data) { if (!r.woo_id) sinWooId.push(r); }
      if (data.length < 1000) break;
      offset += 1000;
    }

    // 3. Cargar SKUs de variaciones de Supabase
    const skuToParentId = new Map<string, string>();
    offset = 0;
    while (true) {
      const { data } = await supa.from("productos_variaciones").select("sku, producto_padre_id").range(offset, offset + 999);
      if (!data || data.length === 0) break;
      for (const r of data) { if (r.sku) skuToParentId.set(r.sku.trim().toLowerCase(), r.producto_padre_id); }
      if (data.length < 1000) break;
      offset += 1000;
    }

    // 4. Índices O(1)
    const idToPadre = new Map(sinWooId.map(p => [p.id, p]));
    const slugToPadre = new Map(sinWooId.map(p => [slugify(p.slug), p]));
    const nombreToPadre = new Map<string, typeof sinWooId[0]>();
    for (const p of sinWooId) {
      const key = p.nombre.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
      if (!nombreToPadre.has(key)) nombreToPadre.set(key, p);
    }

    // 5. Matching: SKU → slug → nombre
    setBfProgress("Emparejando productos…", 0, wooProducts.length);
    const updates = new Map<string, number>();
    const unmatched: { id: number; name: string; slug: string }[] = [];
    let bySku = 0, bySlug = 0, byName = 0;

    for (let i = 0; i < wooProducts.length; i++) {
      const wp = wooProducts[i];
      let matched: typeof sinWooId[0] | undefined;
      let metodo: "sku" | "slug" | "nombre" | undefined;

      // By SKU (solo el SKU del padre, sin descargar variaciones)
      if (wp.sku) {
        const parentId = skuToParentId.get(wp.sku.trim().toLowerCase());
        if (parentId) { matched = idToPadre.get(parentId); if (matched) metodo = "sku"; }
      }

      // By slug
      if (!matched) { matched = slugToPadre.get(slugify(wp.slug)); if (matched) metodo = "slug"; }

      // By name
      if (!matched) {
        const key = wp.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
        matched = nombreToPadre.get(key); if (matched) metodo = "nombre";
      }

      if (!matched) { unmatched.push({ id: wp.id, name: wp.name, slug: wp.slug }); continue; }
      if (updates.has(matched.id)) continue;
      updates.set(matched.id, wp.id);
      if (metodo === "sku") bySku++; else if (metodo === "slug") bySlug++; else byName++;
      if (i % 500 === 0) setBfProgress("Emparejando productos…", i, wooProducts.length);
    }

    // 6. Batch update (usar UPDATE directo en vez de upsert)
    setBfProgress("Guardando vínculos…", 0, updates.size);
    const pares = Array.from(updates.entries()).map(([id, woo_id]) => ({ id, woo_id }));
    let actualizados = 0;
    let lastError = "";
    for (let i = 0; i < pares.length; i += 50) {
      const chunk = pares.slice(i, i + 50);
      // Update individual por cada producto (más seguro que upsert)
      const results = await Promise.all(chunk.map(({ id, woo_id }) =>
        supa.from("productos_padre").update({ woo_id }).eq("id", id)
      ));
      const errors = results.filter(r => r.error);
      if (errors.length > 0) {
        lastError = errors[0].error!.message;
        console.error(`[backfill] Update errors:`, errors.map(e => e.error!.message));
      }
      actualizados += chunk.length - errors.length;
      setBfProgress("Guardando vínculos…", actualizados, pares.length);
    }

    const result: BackfillResult = { ok: actualizados, bySku, bySlug, byName, unmatched: unmatched.length, unmatchedList: unmatched.slice(0, 50), error: lastError || undefined };
    _backfillProgress = { phase: "Completado", current: actualizados, total: actualizados, done: true, result };
    await _saveProgressToDb(_backfillProgress);
    return result;
  } catch (e) {
    const result: BackfillResult = { ok: 0, bySku: 0, bySlug: 0, byName: 0, unmatched: 0, unmatchedList: [], error: String(e) };
    _backfillProgress = { phase: "Error", current: 0, total: 0, done: true, result };
    await _saveProgressToDb(_backfillProgress);
    return result;
  }
}

// ─── Snapshot: guardar estado actual de WC para comparación incremental ──────

export async function guardarSnapshot(): Promise<{ ok: number; error?: string }> {
  try {
    await verificarAdmin();
  } catch {
    return { ok: 0, error: "No autorizado" };
  }

  try {
    const supa = adminClient();

    // 1. Descargar todos los productos de WC
    const wooProductos: { id: number; name: string; slug: string; price: string; regular_price: string; stock_quantity: number | null; stock_status: string }[] = [];
    let page = 1;
    while (true) {
      const batch = await fetchWoo(`/products?status=publish&per_page=100&page=${page}`);
      if (!Array.isArray(batch) || batch.length === 0) break;
      wooProductos.push(...batch);
      if (batch.length < 100) break;
      page++;
      await new Promise(r => setTimeout(r, 500)); // Delay para evitar 503
    }

    // 2. Construir filas para el snapshot
    const rows = wooProductos.map(p => ({
      woo_id: p.id,
      slug: p.slug,
      nombre: p.name,
      precio: parseFloat(p.regular_price || p.price) || 0,
      stock: p.stock_quantity ?? null,
      activo: p.stock_status !== "outofstock",
      snapshot_at: new Date().toISOString(),
    }));

    // 3. Upsert en lotes de 500
    let upserted = 0;
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500);
      const { error } = await supa.from("woo_snapshot").upsert(chunk, { onConflict: "woo_id" });
      if (error) return { ok: upserted, error: error.message };
      upserted += chunk.length;
    }

    return { ok: upserted };
  } catch (e) {
    return { ok: 0, error: String(e) };
  }
}

// ─── calcularDiff: comparar WC actual vs snapshot ────────────────────────────
