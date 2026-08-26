import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Vercel Cron usa el header Authorization: Bearer <CRON_SECRET>
const CRON_SECRET = process.env.CRON_SECRET;

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function fetchWoo(path: string) {
  const auth = Buffer.from(`${process.env.WOO_CONSUMER_KEY}:${process.env.WOO_CONSUMER_SECRET}`).toString("base64");
  const res = await fetch(`${process.env.WOO_URL}/wp-json/wc/v3${path}`, {
    headers: { Authorization: `Basic ${auth}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`WooCommerce ${res.status}: ${path}`);
  return res.json();
}

export async function GET(req: NextRequest) {
  // Verificar que la llamada es de Vercel Cron (o de un admin con el secret)
  const auth = req.headers.get("authorization");
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supa = adminClient();

  let precioMultiplicadorB2b = 0.75;
  try {
    const { data } = await supa.from("config_tienda").select("valor").eq("clave", "precio_multiplicador_b2b").single();
    if (data?.valor) precioMultiplicadorB2b = parseFloat(data.valor) || 0.75;
  } catch { /* usar fallback */ }

  // Cargar todas las variaciones por SKU de una vez
  const allVars: Array<{ id: string; sku: string | null; producto_padre_id: string }> = [];
  let offset = 0;
  while (true) {
    const { data } = await supa.from("productos_variaciones").select("id, sku, producto_padre_id").range(offset, offset + 999);
    if (!data?.length) break;
    allVars.push(...data);
    if (data.length < 1000) break;
    offset += 1000;
  }
  const varsBySku = new Map(allVars.filter(v => v.sku).map(v => [v.sku as string, v]));

  let page = 1;
  let totalActualizados = 0;
  let totalNoEncontrados = 0;

  while (true) {
    type WooProduct = {
      id: number; type: string; sku: string; name: string;
      regular_price: string; sale_price: string; price: string;
      stock_quantity: number | null; stock_status: string;
      variations: number[];
    };

    const products: WooProduct[] = await fetchWoo(`/products?per_page=100&page=${page}&status=publish`);
    if (!Array.isArray(products) || products.length === 0) break;

    // Precargar mapa woo_id → padre_id para esta página
    const wooIds = products.map(p => p.id);
    const padresPorWooId = new Map<number, string>();
    const { data: padres } = await supa.from("productos_padre").select("id, woo_id").in("woo_id", wooIds);
    for (const p of padres ?? []) if (p.woo_id) padresPorWooId.set(p.woo_id, p.id);
    const varsByPadreId = new Map<string, typeof allVars>();
    for (const v of allVars) {
      const arr = varsByPadreId.get(v.producto_padre_id) ?? [];
      arr.push(v);
      varsByPadreId.set(v.producto_padre_id, arr);
    }

    for (const wp of products) {
      const precioRegular = parseFloat(wp.regular_price || wp.price) || 0;
      const precioVenta = parseFloat(wp.sale_price) || 0;
      const isOferta = precioVenta > 0 && precioVenta < precioRegular;
      const precioB2c = isOferta ? precioVenta : precioRegular;
      const precioB2b = parseFloat((precioB2c * precioMultiplicadorB2b).toFixed(2));
      const stock = wp.stock_quantity ?? 0;
      const activa = wp.stock_status !== "outofstock";

      if (wp.type === "simple") {
        let varRow = wp.sku ? varsBySku.get(wp.sku) : undefined;
        if (!varRow) {
          const padreId = padresPorWooId.get(wp.id);
          if (padreId) varRow = varsByPadreId.get(padreId)?.[0];
        }
        if (!varRow) { totalNoEncontrados++; continue; }

        await supa.from("productos_variaciones").update({
          precio_b2c: precioB2c, precio_b2b: precioB2b,
          precio_comparar: isOferta ? precioRegular : null,
          stock, activa,
        }).eq("id", varRow.id);
        await supa.from("productos_padre").update({ oferta: isOferta }).eq("id", varRow.producto_padre_id);
        totalActualizados++;

      } else if (wp.type === "variable" && wp.variations?.length) {
        type WooVar = { id: number; sku: string; regular_price: string; sale_price: string; price: string; stock_quantity: number | null; stock_status: string };
        try {
          const wcVars: WooVar[] = await fetchWoo(`/products/${wp.id}/variations?per_page=100`);
          let matchedAny = false;
          for (const wv of wcVars) {
            const varRow = wv.sku ? varsBySku.get(wv.sku) : undefined;
            if (!varRow) continue;
            const vReg = parseFloat(wv.regular_price || wv.price) || 0;
            const vSale = parseFloat(wv.sale_price) || 0;
            const vOferta = vSale > 0 && vSale < vReg;
            const vB2c = vOferta ? vSale : vReg;
            await supa.from("productos_variaciones").update({
              precio_b2c: vB2c,
              precio_b2b: parseFloat((vB2c * precioMultiplicadorB2b).toFixed(2)),
              precio_comparar: vOferta ? vReg : null,
              stock: wv.stock_quantity ?? 0,
              activa: wv.stock_status !== "outofstock",
            }).eq("id", varRow.id);
            matchedAny = true;
            totalActualizados++;
          }
          if (matchedAny) {
            const padreId = padresPorWooId.get(wp.id);
            if (padreId) await supa.from("productos_padre").update({ oferta: isOferta }).eq("id", padreId);
          } else {
            totalNoEncontrados++;
          }
          await new Promise(r => setTimeout(r, 200));
        } catch { totalNoEncontrados++; }
      }
    }

    if (products.length < 100) break;
    page++;
    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`[cron/sync-precios] actualizados=${totalActualizados} noEncontrados=${totalNoEncontrados}`);
  return NextResponse.json({ ok: true, actualizados: totalActualizados, noEncontrados: totalNoEncontrados });
}
