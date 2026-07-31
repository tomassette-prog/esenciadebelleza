"use server";

import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

const ADMIN_EMAILS = ["ziarresamot@gmail.com"];
const WOO_URL = process.env.WOO_URL!;
const CK = process.env.WOO_CONSUMER_KEY!;
const CS = process.env.WOO_CONSUMER_SECRET!;

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

function normalizarNombre(nombre: string): string {
  return nombre
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[.,;:()[\]"'ºª-]/g, " ") // puntuación no debe impedir el match por nombre
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Sync prices from WooCommerce for Esencia products that have missing or zero prices.
 * Optimized: only fetches specific WC products that need prices, not the entire catalog.
 */
export async function sincronizarPrecios(): Promise<{
  ok: number;
  actualizados: number;
  sinMatch: number;
  error?: string;
}> {
  try {
    await verificarAdmin();
  } catch {
    return { ok: 0, actualizados: 0, sinMatch: 0, error: "No autorizado" };
  }

  try {
    const supa = adminClient();

    type WooProduct = {
      id: number; slug: string; sku: string; name: string;
      regular_price: string; sale_price: string; price: string;
      stock_quantity: number | null; stock_status: string;
      type: string; images: { src: string }[];
    };

    // 1. Load ALL Esencia products
    const esenciaProducts: Array<{ id: string; slug: string; nombre: string; woo_id: number | null }> = [];
    let offset = 0;
    while (true) {
      const { data } = await supa
        .from("productos_padre")
        .select("id, slug, nombre, woo_id")
        .range(offset, offset + 999);
      if (!data || data.length === 0) break;
      esenciaProducts.push(...data);
      if (data.length < 1000) break;
      offset += 1000;
    }

    // 2. Load variations to find products with missing/zero prices
    const allVars: Array<{ id: string; producto_padre_id: string; precio_b2c: number | null; sku: string | null; activa: boolean }> = [];
    offset = 0;
    while (true) {
      const { data } = await supa
        .from("productos_variaciones")
        .select("id, producto_padre_id, precio_b2c, sku, activa")
        .range(offset, offset + 999);
      if (!data || data.length === 0) break;
      allVars.push(...data);
      if (data.length < 1000) break;
      offset += 1000;
    }

    const hasValidPrice = new Set<string>();
    for (const v of allVars) {
      if (v.precio_b2c && v.precio_b2c > 0.1) {
        hasValidPrice.add(v.producto_padre_id);
      }
    }

    // Also collect dummy SKUs (VAR-*) that need cleanup
    const dummyVars = allVars.filter(v => v.sku?.startsWith("VAR-") && (!v.precio_b2c || v.precio_b2c <= 0.1));
    const dummyByProduct = new Map<string, string>();
    for (const d of dummyVars) dummyByProduct.set(d.producto_padre_id, d.id);

    // 3. Find products that need prices — collect their woo_ids
    const needsPrice = esenciaProducts.filter(ep => !hasValidPrice.has(ep.id));
    const needsPriceWithWooId = needsPrice.filter(ep => ep.woo_id && ep.woo_id > 0);
    const needsPriceNoWooId = needsPrice.filter(ep => !ep.woo_id || ep.woo_id <= 0);
    const wooIds = [...new Set(needsPriceWithWooId.map(ep => ep.woo_id!))];

    // 4. Fetch WC products by ID (batch by IDs, max 50 per request with delay)
    const wooById = new Map<number, WooProduct>();
    const wooByName = new Map<string, WooProduct>();

    for (let i = 0; i < wooIds.length; i += 50) {
      const batch = wooIds.slice(i, i + 50);
      try {
        const batchData = await fetchWoo(`/products?include=${batch.join(",")}&per_page=100`);
        if (Array.isArray(batchData)) {
          for (const wp of batchData) wooById.set(wp.id, wp);
        }
      } catch (e) {
        await new Promise(r => setTimeout(r, 5000));
        const retry = await fetchWoo(`/products?include=${batch.join(",")}&per_page=100`);
        if (Array.isArray(retry)) {
          for (const wp of retry) wooById.set(wp.id, wp);
        }
      }
      await new Promise(r => setTimeout(r, 500));
    }

    // 4b. For products without woo_id, search WC by name
    for (const ep of needsPriceNoWooId) {
      try {
        const searchData = await fetchWoo(`/products?search=${encodeURIComponent(ep.slug)}&per_page=5`);
        if (Array.isArray(searchData) && searchData.length > 0) {
          // Try exact name match first, then slug match
          const exact = searchData.find((wp: WooProduct) =>
            wp.name.toLowerCase() === ep.nombre?.toLowerCase() ||
            wp.slug === ep.slug
          );
          const match = exact || searchData[0];
          wooByName.set(ep.id, match);
        }
      } catch { /* skip */ }
      await new Promise(r => setTimeout(r, 300));
    }

    // 5. Match and prepare updates
    const toUpdate: Array<{ id: string; slug: string; woo: WooProduct }> = [];
    let sinMatch = 0;

    for (const ep of needsPriceWithWooId) {
      const woo = wooById.get(ep.woo_id!);
      if (!woo) { sinMatch++; continue; }
      const precioRegular = parseFloat(woo.regular_price || woo.price) || 0;
      if (precioRegular <= 0) { sinMatch++; continue; }
      toUpdate.push({ id: ep.id, slug: ep.slug, woo });
    }

    // 5b. Add products found by name search
    for (const ep of needsPriceNoWooId) {
      const woo = wooByName.get(ep.id);
      if (!woo) { sinMatch++; continue; }
      const precioRegular = parseFloat(woo.regular_price || woo.price) || 0;
      if (precioRegular <= 0) { sinMatch++; continue; }
      toUpdate.push({ id: ep.id, slug: ep.slug, woo });
    }

    // 6. Load precio_multiplicador_b2b
    let precioMultiplicador = 0.75;
    try {
      const { data: configMult } = await supa.from("config_tienda")
        .select("valor").eq("clave", "precio_multiplicador_b2b").single();
      if (configMult?.valor) precioMultiplicador = parseFloat(configMult.valor) || 0.75;
    } catch { /* usar fallback */ }

    // 7. Load existing variation SKUs
    const existingSkus = new Set<string>();
    offset = 0;
    while (true) {
      const { data } = await supa.from("productos_variaciones").select("sku").range(offset, offset + 999);
      if (!data || data.length === 0) break;
      for (const v of data) { if (v.sku) existingSkus.add(v.sku); }
      if (data.length < 1000) break;
      offset += 1000;
    }

    // 8. Apply updates
    let actualizados = 0;
    for (const { id, woo } of toUpdate) {
      const precioRegular = parseFloat(woo.regular_price || woo.price) || 0;
      const precioVenta = parseFloat(woo.sale_price) || 0;
      const imagenUrl = woo.images?.[0]?.src ?? null;
      const isOferta = precioVenta > 0 && precioVenta < precioRegular;

      const prodUpdates: Record<string, unknown> = { oferta: isOferta };
      if (imagenUrl) prodUpdates.imagen_principal_url = imagenUrl;
      await supa.from("productos_padre").update(prodUpdates).eq("id", id);

      if (woo.type === "simple" && woo.sku) {
        const precioB2b = parseFloat((precioRegular * precioMultiplicador).toFixed(2));
        const precioComparar = isOferta ? precioRegular : null;

        if (existingSkus.has(woo.sku)) {
          await supa.from("productos_variaciones").update({
            precio_b2c: precioRegular,
            precio_b2b: precioB2b,
            precio_comparar: precioComparar,
            stock: woo.stock_quantity ?? 0,
            activa: true, // Siempre activar — Google necesita ver disponibilidad
          }).eq("sku", woo.sku);
        } else {
          await supa.from("productos_variaciones").insert({
            producto_padre_id: id,
            sku: woo.sku,
            nombre_variacion: "Unidad",
            precio_b2c: precioRegular,
            precio_b2b: precioB2b,
            precio_comparar: precioComparar,
            stock: woo.stock_quantity ?? 0,
            activa: true,
            imagen_url: imagenUrl,
          });
        }
      }
      actualizados++;
    }

    // 9. Clean up dummy variations (VAR-*) for products that now have real variations with prices
    const updatedProductIds = new Set(toUpdate.map(u => u.id));
    const dummyIdsToDelete: string[] = [];
    for (const [prodId, dummyId] of dummyByProduct) {
      if (updatedProductIds.has(prodId)) {
        dummyIdsToDelete.push(dummyId);
      }
    }
    if (dummyIdsToDelete.length > 0) {
      await supa.from("productos_variaciones").delete().in("id", dummyIdsToDelete);
    }

    return { ok: toUpdate.length, actualizados, sinMatch };
  } catch (e) {
    return { ok: 0, actualizados: 0, sinMatch: 0, error: String(e) };
  }
}

/**
 * Sync ALL products from WC — update prices, stock, and sale prices for ALL products,
 * not just those without price. Handles both simple and variable products.
 * Matches by SKU first, falls back to woo_id if SKU doesn't align.
 * Use this to refresh the entire catalog prices from WooCommerce (source of truth).
 */
export async function sincronizarTodosPrecios(): Promise<{
  ok: number;
  actualizados: number;
  noEncontrados: number;
  noEncontradosList: string[];
  error?: string;
}> {
  try {
    await verificarAdmin();
  } catch {
    return { ok: 0, actualizados: 0, noEncontrados: 0, noEncontradosList: [], error: "No autorizado" };
  }

  try {
    const supa = adminClient();

    type WooProduct = {
      id: number; slug: string; sku: string; name: string;
      regular_price: string; sale_price: string; price: string;
      stock_quantity: number | null; stock_status: string;
      type: string; variations: number[];
    };

    type WooVariation = {
      id: number; sku: string;
      regular_price: string; sale_price: string; price: string;
      stock_quantity: number | null; stock_status: string;
    };

    // 1. Fetch all WC products (paginated) — incluye publish + draft/private para no perder ninguno
    const wooProducts: WooProduct[] = [];
    let page = 1;
    while (true) {
      const batch = await fetchWoo(`/products?per_page=100&page=${page}&status=publish`);
      if (!Array.isArray(batch) || batch.length === 0) break;
      wooProducts.push(...batch);
      if (batch.length < 100) break;
      page++;
      await new Promise(r => setTimeout(r, 200));
    }

    // 2. Load multiplicador B2B
    let precioMultiplicador = 0.75;
    try {
      const { data: configMult } = await supa.from("config_tienda")
        .select("valor").eq("clave", "precio_multiplicador_b2b").single();
      if (configMult?.valor) precioMultiplicador = parseFloat(configMult.valor) || 0.75;
    } catch { /* fallback */ }

    // 3. Cargar todos los productos padre (para fallback por woo_id y por nombre)
    const padresPorWooId = new Map<number, string>(); // woo_id -> producto_padre_id
    const padresPorNombre = new Map<string, string>(); // nombre normalizado -> producto_padre_id
    let offset = 0;
    while (true) {
      const { data } = await supa
        .from("productos_padre")
        .select("id, woo_id, nombre")
        .range(offset, offset + 999);
      if (!data?.length) break;
      for (const r of data) {
        if (r.woo_id) padresPorWooId.set(r.woo_id, r.id);
        padresPorNombre.set(normalizarNombre(r.nombre), r.id);
      }
      if (data.length < 1000) break;
      offset += 1000;
    }

    // 4. Cargar todas las variaciones existentes — por SKU y por producto_padre_id
    const allVars: Array<{ id: string; sku: string | null; producto_padre_id: string }> = [];
    offset = 0;
    while (true) {
      const { data } = await supa
        .from("productos_variaciones")
        .select("id, sku, producto_padre_id")
        .range(offset, offset + 999);
      if (!data?.length) break;
      allVars.push(...data);
      if (data.length < 1000) break;
      offset += 1000;
    }
    const varsBySku = new Map(allVars.filter(v => v.sku).map(v => [v.sku as string, v]));
    const varsByPadreId = new Map<string, typeof allVars>();
    for (const v of allVars) {
      const arr = varsByPadreId.get(v.producto_padre_id) ?? [];
      arr.push(v);
      varsByPadreId.set(v.producto_padre_id, arr);
    }

    let actualizados = 0;
    const noEncontradosSet = new Set<string>();
    // padreId -> true si alguna variación tiene oferta activa
    const ofertaPorPadre = new Map<string, boolean>();
    // padreId -> woo_id a rellenar cuando el match se resolvió por nombre (self-healing para futuros syncs)
    const woo_idsPorBackfillear = new Map<string, number>();

    async function updateVariacion(varId: string, padreId: string, precioB2c: number, precioRegular: number, isOferta: boolean, stock: number, activa: boolean) {
      await supa.from("productos_variaciones").update({
        precio_b2c: precioB2c,
        precio_b2b: parseFloat((precioB2c * precioMultiplicador).toFixed(2)),
        precio_comparar: isOferta ? precioRegular : null,
        stock,
        activa,
      }).eq("id", varId);
      ofertaPorPadre.set(padreId, ofertaPorPadre.get(padreId) || isOferta);
      actualizados++;
    }

    // 5. Process simple products
    for (const wp of wooProducts) {
      if (wp.type !== "simple") continue;

      const precioRegular = parseFloat(wp.regular_price || wp.price) || 0;
      const precioVenta = parseFloat(wp.sale_price) || 0;
      const isOferta = precioVenta > 0 && precioVenta < precioRegular;
      const precioB2c = isOferta ? precioVenta : precioRegular;
      const stock = wp.stock_quantity ?? 0;
      const activa = wp.stock_status !== "outofstock";

      // Match 1: por SKU exacto
      let existingVar = wp.sku ? varsBySku.get(wp.sku) : undefined;

      // Match 2 (fallback): por woo_id → producto_padre_id → primera variación
      if (!existingVar) {
        const padreId = padresPorWooId.get(wp.id);
        if (padreId) {
          const vars = varsByPadreId.get(padreId);
          existingVar = vars?.[0];
        }
      }

      // Match 3 (fallback): por nombre normalizado → producto_padre_id → primera variación
      if (!existingVar) {
        const padreId = padresPorNombre.get(normalizarNombre(wp.name));
        if (padreId) {
          const vars = varsByPadreId.get(padreId);
          existingVar = vars?.[0];
          if (existingVar && !padresPorWooId.has(wp.id)) woo_idsPorBackfillear.set(padreId, wp.id);
        }
      }

      if (!existingVar) { noEncontradosSet.add(wp.name); continue; }
      await updateVariacion(existingVar.id, existingVar.producto_padre_id, precioB2c, precioRegular, isOferta, stock, activa);
    }

    // 6. Process variable products — fetch their variations from WC
    const variableProducts = wooProducts.filter(wp => wp.type === "variable" && wp.variations?.length > 0);
    for (const wp of variableProducts) {
      try {
        const wcVars: WooVariation[] = await fetchWoo(`/products/${wp.id}/variations?per_page=100`);
        if (!Array.isArray(wcVars) || wcVars.length === 0) { noEncontradosSet.add(wp.name); continue; }

        const resueltoPorNombre = !padresPorWooId.has(wp.id);
        const padreId = padresPorWooId.get(wp.id) ?? padresPorNombre.get(normalizarNombre(wp.name));
        const padreVars = padreId ? varsByPadreId.get(padreId) : undefined;
        let matchedAny = false;

        // Match por SKU exacto — única forma fiable de vincular una variación de WC con su fila en Supabase.
        // NUNCA emparejar por posición/índice: el orden de /variations no está garantizado y puede
        // asignar el precio de una variación distinta (ej. una muestra de 1€ a un producto de 40€).
        for (const wv of wcVars) {
          const existingVar = wv.sku ? varsBySku.get(wv.sku) : undefined;
          if (!existingVar) continue;
          const precioRegular = parseFloat(wv.regular_price || wv.price) || 0;
          const precioVenta = parseFloat(wv.sale_price) || 0;
          const isOferta = precioVenta > 0 && precioVenta < precioRegular;
          const precioB2c = isOferta ? precioVenta : precioRegular;
          const stock = wv.stock_quantity ?? 0;
          const activa = wv.stock_status !== "outofstock";
          matchedAny = true;
          await updateVariacion(existingVar.id, existingVar.producto_padre_id, precioB2c, precioRegular, isOferta, stock, activa);
        }

        // Fallback: si Esencia solo tiene 1 fila para este producto variable (sin SKU propio por
        // variación en WC), usar el precio del producto padre — igual que hace la importación inicial.
        if (!matchedAny && padreVars?.length === 1) {
          const precioRegular = parseFloat(wp.regular_price || wp.price) || 0;
          if (precioRegular > 0) {
            const precioVenta = parseFloat(wp.sale_price) || 0;
            const isOferta = precioVenta > 0 && precioVenta < precioRegular;
            const precioB2c = isOferta ? precioVenta : precioRegular;
            const stock = wp.stock_quantity ?? 0;
            const activa = wp.stock_status !== "outofstock";
            const v = padreVars[0];
            matchedAny = true;
            await updateVariacion(v.id, v.producto_padre_id, precioB2c, precioRegular, isOferta, stock, activa);
          }
        }

        if (matchedAny && resueltoPorNombre && padreId) woo_idsPorBackfillear.set(padreId, wp.id);
        if (!matchedAny) noEncontradosSet.add(wp.name);

        // Small delay between variable products to avoid rate limiting
        await new Promise(r => setTimeout(r, 300));
      } catch {
        noEncontradosSet.add(wp.name);
      }
    }

    // 7. Update oferta flags on parent products — explícito true/false para no dejar ofertas obsoletas
    for (const [padreId, isOferta] of ofertaPorPadre) {
      await supa.from("productos_padre").update({ oferta: isOferta }).eq("id", padreId);
    }

    // 8. Backfill woo_id para productos que solo se pudieron vincular por nombre — así el próximo
    // sync ya los encuentra directo por woo_id y deja de depender del match por nombre.
    for (const [padreId, wooId] of woo_idsPorBackfillear) {
      await supa.from("productos_padre").update({ woo_id: wooId }).eq("id", padreId);
    }

    return {
      ok: wooProducts.length,
      actualizados,
      noEncontrados: noEncontradosSet.size,
      noEncontradosList: [...noEncontradosSet].slice(0, 50),
    };
  } catch (e) {
    return { ok: 0, actualizados: 0, noEncontrados: 0, noEncontradosList: [], error: String(e) };
  }
}
