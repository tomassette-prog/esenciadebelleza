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
 * Also updates stock and sale prices.
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

    // 1. Fetch ALL WooCommerce products (paginated)
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

    // 2. Build lookup maps from WC
    const wooBySlug = new Map<string, WooProduct>();
    const wooByWooId = new Map<number, WooProduct>();
    for (const wp of wooProducts) {
      wooBySlug.set(wp.slug, wp);
      wooByWooId.set(wp.id, wp);
    }

    // 3. Load ALL Esencia products
    const esenciaProducts: Array<{ id: string; slug: string; woo_id: number | null }> = [];
    let offset = 0;
    while (true) {
      const { data } = await supa
        .from("productos_padre")
        .select("id, slug, woo_id")
        .range(offset, offset + 999);
      if (!data || data.length === 0) break;
      esenciaProducts.push(...data);
      if (data.length < 1000) break;
      offset += 1000;
    }

    // 4. Load ALL variations in bulk to find which products have prices
    const allVars: Array<{ producto_padre_id: string; precio_b2c: number | null }> = [];
    offset = 0;
    while (true) {
      const { data } = await supa
        .from("productos_variaciones")
        .select("producto_padre_id, precio_b2c")
        .range(offset, offset + 999);
      if (!data || data.length === 0) break;
      allVars.push(...data);
      if (data.length < 1000) break;
      offset += 1000;
    }

    // Build set of product IDs that already have valid prices
    const hasValidPrice = new Set<string>();
    for (const v of allVars) {
      if (v.precio_b2c && v.precio_b2c > 0) {
        hasValidPrice.add(v.producto_padre_id);
      }
    }

    // 5. Find products that need prices
    const needsPrice: Array<{ id: string; slug: string; woo: WooProduct }> = [];

    for (const ep of esenciaProducts) {
      if (hasValidPrice.has(ep.id)) continue;

      // Find matching WC product
      const woo = (ep.woo_id && wooByWooId.get(ep.woo_id)) || wooBySlug.get(ep.slug);
      if (!woo) continue;

      const precioRegular = parseFloat(woo.regular_price || woo.price) || 0;
      if (precioRegular <= 0) continue;

      needsPrice.push({ id: ep.id, slug: ep.slug, woo });
    }

    // 4. Load precio_multiplicador_b2b
    let precioMultiplicador = 0.75;
    try {
      const { data: configMult } = await supa.from("config_tienda")
        .select("valor").eq("clave", "precio_multiplicador_b2b").single();
      if (configMult?.valor) precioMultiplicador = parseFloat(configMult.valor) || 0.75;
    } catch { /* usar fallback */ }

    // 5. Load all existing variation SKUs in bulk for matching
    const existingSkus = new Set<string>();
    offset = 0;
    while (true) {
      const { data } = await supa.from("productos_variaciones").select("sku").range(offset, offset + 999);
      if (!data || data.length === 0) break;
      for (const v of data) { if (v.sku) existingSkus.add(v.sku); }
      if (data.length < 1000) break;
      offset += 1000;
    }

    // 6. Update prices
    let actualizados = 0;
    let sinMatch = 0;

    for (const { id, slug, woo } of needsPrice) {
      const precioRegular = parseFloat(woo.regular_price || woo.price) || 0;
      const precioVenta = parseFloat(woo.sale_price) || 0;
      const imagenUrl = woo.images?.[0]?.src ?? null;
      const isOferta = precioVenta > 0 && precioVenta < precioRegular;

      // Update product fields
      const prodUpdates: any = { oferta: isOferta };
      if (imagenUrl) prodUpdates.imagen_principal_url = imagenUrl;
      await supa.from("productos_padre").update(prodUpdates).eq("id", id);

      // Update or create variation
      if (woo.type === "simple" && woo.sku) {
        const precioB2b = parseFloat((precioRegular * precioMultiplicador).toFixed(2));
        const precioComparar = precioVenta > 0 && precioVenta < precioRegular ? precioRegular : null;

        if (existingSkus.has(woo.sku)) {
          await supa.from("productos_variaciones").update({
            precio_b2c: precioRegular,
            precio_b2b: precioB2b,
            precio_comparar: precioComparar,
            stock: woo.stock_quantity ?? 0,
            activa: woo.stock_status !== "outofstock",
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
            activa: woo.stock_status !== "outofstock",
            imagen_url: imagenUrl,
          });
        }
      }

      actualizados++;
    }

    return { ok: needsPrice.length, actualizados, sinMatch };
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
        activa: wp.stock_status !== "outofstock",
      }).eq("sku", wp.sku);

      actualizados++;
    }

    return { ok: wooProducts.length, actualizados, noEncontrados };
  } catch (e) {
    return { ok: 0, actualizados: 0, noEncontrados: 0, error: String(e) };
  }
}
