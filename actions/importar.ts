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

function extractBrandName(productName: string): string {
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

function detectNewBrands(
  nuevos: ProductoDiff[],
  wooMap: Map<number, { name: string }>,
  existingMarcaSlugs: Set<string>
): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const nuevo of nuevos) {
    const woo = wooMap.get(nuevo.wooId);
    if (!woo) continue;
    const brandName = extractBrandName(woo.name);
    const brandSlug = slugify(brandName);
    if (!existingMarcaSlugs.has(brandSlug) && !seen.has(brandSlug)) {
      seen.add(brandSlug);
      result.push(brandName);
    }
  }
  return result;
}

export interface ProductoDiff {
  slug: string;
  nombre: string;
  tipo: "nuevo" | "modificado";
  wooId: number;
  wooCategories: number[];
  cambios?: Record<string, { woo: string | null; actual: string | null }>;
  precioCambio?: { woo: number; actual: number };
}

export interface UnmappedCategory {
  wooCatId: number;
  wooCatName: string;
  suggestedCategoria: string;
  suggestedSubcategoria: string;
  confidence: "high" | "medium" | "low";
}

export interface DiffGaps {
  newBrands: string[];
  unmappedCategories: UnmappedCategory[];
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
  error?: string;
}> {
  try {
    await verificarAdmin();
  } catch {
    return { nuevos: [], modificados: [], iguales: 0, gaps: { newBrands: [], unmappedCategories: [] }, error: "No autorizado" };
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
    }[] = [];
    let page = 1;
    while (true) {
      const batch = await fetchWoo(`/products?status=publish&per_page=100&page=${page}`);
      if (!Array.isArray(batch) || batch.length === 0) break;
      wooProductos.push(...batch);
      if (batch.length < 100) break;
      page++;
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
    const supaPrecios = new Map<string, number>();  // SKU -> precio_b2c actual
    
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

    // Cargar precios actuales de variaciones
    offset = 0;
    while (true) {
      const { data } = await supa
        .from("productos_variaciones")
        .select("sku, precio_b2c")
        .range(offset, offset + 999);
      if (!data || data.length === 0) break;
      for (const r of data) supaPrecios.set(r.sku, r.precio_b2c);
      if (data.length < 1000) break;
      offset += 1000;
    }

    // 3. Comparar SOLO precios (ignorar nombre, categoría, stock, etc.)
    // Deduplicación: Buscar por woo_id primero (más confiable que slug)
    const catMap = await getDbCatMap(supa);
    const nuevos: ProductoDiff[] = [];
    const modificados: ProductoDiff[] = [];
    let iguales = 0;

    for (const p of wooProductos) {
      const slug = p.slug || slugify(p.name);
      
      // Buscar por woo_id primero (deduplicación robusta)
      let slugEnDB: string | undefined;
      if (p.id) {
        slugEnDB = supaMapByWooId.get(p.id);
      }
      // Fallback: buscar por slug si no hay woo_id match
      if (!slugEnDB) {
        slugEnDB = slug;
      }
      
      const existing = supaMap.get(slugEnDB);

      if (!existing) {
        // Producto nuevo en WooCommerce
        nuevos.push({ slug, nombre: p.name, tipo: "nuevo", wooId: p.id, wooCategories: p.categories.map(c => c.id) });
        continue;
      }

      // Producto existente — solo comparar PRECIO
      const wooPrice = parseFloat(p.price || p.regular_price) || 0;
      const sku = p.sku || slug;  // Fallback al slug si no hay SKU
      const precioActual = supaPrecios.get(sku) ?? 0;

      if (wooPrice !== precioActual && wooPrice > 0) {
        // Precio cambió
        modificados.push({
          slug: slugEnDB,  // Usar el slug encontrado en DB
          nombre: p.name,
          tipo: "modificado",
          wooId: p.id,
          wooCategories: p.categories.map(c => c.id),
          precioCambio: { woo: wooPrice, actual: precioActual }
        });
      } else {
        // Precio igual (ignora cualquier otro cambio)
        iguales++;
      }
    }

    // 4. Detectar gaps: marcas nuevas y categorías sin mapear
    const { data: marcasRows } = await supa.from("marcas").select("slug");
    const existingMarcaSlugs = new Set<string>((marcasRows ?? []).map((r: { slug: string }) => r.slug));
    const wooMap = new Map(wooProductos.map(p => [p.id, { name: p.name }]));
    const newBrands = detectNewBrands(nuevos, wooMap, existingMarcaSlugs);

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
        const suggestion = suggestCategory(wooCatName, nuevo.nombre);
        unmappedCategories.push({
          wooCatId: catId,
          wooCatName,
          suggestedCategoria: suggestion.categoria,
          suggestedSubcategoria: suggestion.subcategoria,
          confidence: suggestion.confidence,
        });
      }
    }

    const gaps: DiffGaps = { newBrands, unmappedCategories };

    return { nuevos, modificados, iguales, gaps };
  } catch (e) {
    return { nuevos: [], modificados: [], iguales: 0, gaps: { newBrands: [], unmappedCategories: [] }, error: String(e) };
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
      categories: { id: number }[];
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
    // IMPORTANTE: Solo actualizar PRECIOS, no tocar otros campos del producto
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    let actualizados = 0;

    // Actualizar variaciones para productos simples (SOLO actualizar precio)
    for (const p of seleccionados) {
      if (p.type !== "simple" || !p.sku) continue;
      const { data: padre } = await supa.from("productos_padre").select("id").eq("slug", p.slug || slugify(p.name)).single();
      if (!padre) continue;
      const precio = parseFloat(p.price || p.regular_price) || 0;
      
      // Primero intentar UPDATE (para productos existentes) — solo actualizar precio
      const { data: existing, error: selectError } = await supa
        .from("productos_variaciones")
        .select("id")
        .eq("sku", p.sku)
        .single();
      
      if (existing) {
        // Producto existente — actualizar SOLO precio
        const { error } = await supa
          .from("productos_variaciones")
          .update({
            precio_b2c: precio,
            precio_b2b: precio,
          })
          .eq("sku", p.sku);
        if (!error) actualizados++;
      } else {
        // Producto nuevo — insertar con todos los campos
        const { error } = await supa
          .from("productos_variaciones")
          .insert({
            producto_id: padre.id,
            sku: p.sku,
            nombre_variacion: "Unidad",
            precio_b2c: precio,
            precio_b2b: precio,
            stock: 0,
            activa: true,
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

  if (!payload.approvedGroups.length) return empty;

  try {
    const supa = adminClient();

    // Step B — fetch products from WooCommerce by ID
    type WooProducto = {
      id: number; name: string; slug: string; type: string;
      description: string; short_description: string; sku: string;
      price: string; regular_price: string;
      stock_quantity: number | null; stock_status: string;
      images: { src: string }[];
      categories: { id: number; name: string }[];
    };

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

    // Step C — auto-create new brands
    const { data: marcasExisting } = await supa.from("marcas").select("id, slug, nombre");
    const marcaSlugToId = new Map<string, number>(
      (marcasExisting ?? []).map((m: { id: number; slug: string }) => [m.slug, m.id])
    );

    const brandsToInsert: Array<{ nombre: string; slug: string; logo_url: null }> = [];
    for (const p of fetched) {
      const brandName = extractBrandName(p.name);
      const brandSlug = slugify(brandName);
      if (!marcaSlugToId.has(brandSlug)) {
        brandsToInsert.push({ nombre: brandName, slug: brandSlug, logo_url: null });
        marcaSlugToId.set(brandSlug, -1); // placeholder to avoid duplicates in loop
      }
    }

    const uniqueBrands = brandsToInsert.filter(
      (b, i, arr) => arr.findIndex(x => x.slug === b.slug) === i
    );
    const brandsCreated: string[] = [];
    if (uniqueBrands.length > 0) {
      const { data: inserted } = await supa.from("marcas")
        .upsert(uniqueBrands, { onConflict: "slug", ignoreDuplicates: true })
        .select("id, slug, nombre");
      // Re-fetch to get actual IDs
      const { data: marcasRefreshed } = await supa.from("marcas").select("id, slug");
      for (const m of marcasRefreshed ?? []) marcaSlugToId.set(m.slug, m.id);
      if (inserted) brandsCreated.push(...inserted.map((m: { nombre: string }) => m.nombre));
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
      .select("slug, destacado, nuevo")
      .in("slug", publishedSlugs);
    const existMap = new Map((existentes ?? []).map(e => [e.slug, e]));

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
      const ex = existMap.get(slug);
      const brandSlug = slugify(extractBrandName(p.name));
      const marcaId = marcaSlugToId.get(brandSlug) ?? null;
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

    // Step E — upsert variaciones for simple products (SOLO actualizar precio)
    for (const p of fetched) {
      if (p.type !== "simple" || !p.sku) continue;
      const { data: padre } = await supa.from("productos_padre")
        .select("id").eq("slug", p.slug || slugify(p.name)).single();
      if (!padre) continue;
      const precio = parseFloat(p.price || p.regular_price) || 0;
      
      // Primero intentar UPDATE (para productos existentes) — solo actualizar precio
      const { data: existing } = await supa
        .from("productos_variaciones")
        .select("id")
        .eq("sku", p.sku)
        .single();
      
      if (existing) {
        // Producto existente — actualizar SOLO precio
        await supa
          .from("productos_variaciones")
          .update({
            precio_b2c: precio,
            precio_b2b: precio,
          })
          .eq("sku", p.sku);
      } else {
        // Producto nuevo — insertar con todos los campos
        await supa
          .from("productos_variaciones")
          .insert({
            producto_id: padre.id,
            sku: p.sku,
            nombre_variacion: "Unidad",
            precio_b2c: precio,
            precio_b2b: precio,
            stock: 0,
            activa: true,
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

    return { ok: rowsNuevos.length + rowsActualizar.length, brandsCreated, seoTriggered, notFound };
  } catch (e) {
    return { ...empty, error: String(e) };
  }
}
