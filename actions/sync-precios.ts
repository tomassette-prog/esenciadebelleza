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
 * not just those without price. Use this to refresh the entire catalog.
 */
export async function sincronizarTodosPrecios(): Promise<{
  ok: number;
  actualizados: number;
  noEncontrados: number;
  error?: string;
}> {
  try {
    await verificarAdmin();
  } catch {
    return { ok: 0, actualizados: 0, noEncontrados: 0, error: "No autorizado" };
  }

  try {
    const supa = adminClient();

    // Fetch all WC products
    type WooProduct = {
      id: number; slug: string; sku: string; name: string;
      regular_price: string; sale_price: string; price: string;
      stock_quantity: number | null; stock_status: string;
      type: string; images: { src: string }[];
    };

    const wooProducts: WooProduct[] = [];
    let page = 1;
    while (true) {
      const batch = await fetchWoo(`/products?per_page=100&page=${page}`);
      if (!Array.isArray(batch) || batch.length === 0) break;
      wooProducts.push(...batch);
      if (batch.length < 100) break;
      page++;
      await new Promise(r => setTimeout(r, 200));
    }

    // Load multiplicador
    let precioMultiplicador = 0.75;
    try {
      const { data: configMult } = await supa.from("config_tienda")
        .select("valor").eq("clave", "precio_multiplicador_b2b").single();
      if (configMult?.valor) precioMultiplicador = parseFloat(configMult.valor) || 0.75;
    } catch { /* fallback */ }

    let actualizados = 0;
    let noEncontrados = 0;

    for (const wp of wooProducts) {
      if (wp.type !== "simple" || !wp.sku) continue;

      const precioRegular = parseFloat(wp.regular_price || wp.price) || 0;
      const precioVenta = parseFloat(wp.sale_price) || 0;

      const { data: existingVar } = await supa
        .from("productos_variaciones")
        .select("id")
        .eq("sku", wp.sku)
        .single();

      if (!existingVar) { noEncontrados++; continue; }

      await supa.from("productos_variaciones").update({
        precio_b2c: precioRegular,
        precio_b2b: parseFloat((precioRegular * precioMultiplicador).toFixed(2)),
        precio_comparar: precioVenta > 0 && precioVenta < precioRegular ? precioRegular : null,
        stock: wp.stock_quantity ?? 0,
        activa: true, // Siempre activar — Google necesita ver disponibilidad
      }).eq("sku", wp.sku);

      actualizados++;
    }

    return { ok: wooProducts.length, actualizados, noEncontrados };
  } catch (e) {
    return { ok: 0, actualizados: 0, noEncontrados: 0, error: String(e) };
  }
}
