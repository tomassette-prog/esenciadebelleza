// Apply price changes directly using WooCommerce batch API
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

export async function POST() {
  const supa = adminClient();
  const auth = Buffer.from(`${CK}:${CS}`).toString("base64");

  // 1. Get all products from Supabase with woo_id
  const { data: supaProducts } = await supa
    .from("productos_padre")
    .select("id, slug, woo_id, oferta, variaciones:productos_variaciones(sku, precio_b2c, precio_comparar, activa)")
    .eq("activo", true)
    .not("woo_id", "is", null);

  if (!supaProducts?.length) {
    return NextResponse.json({ error: "No products with woo_id" }, { status: 400 });
  }

  const supaWooMap = new Map(supaProducts.map(p => [p.woo_id, p]));

  // 2. Fetch products from WooCommerce in batches
  let page = 1;
  let totalUpdated = 0;
  let offersUpdated = 0;
  const errors: string[] = [];

  while (true) {
    const res = await fetch(`${WOO_URL}/wp-json/wc/v3/products?per_page=100&page=${page}&status=publish`, {
      headers: { Authorization: `Basic ${auth}` },
      signal: AbortSignal.timeout(30000)
    });

    if (!res.ok) break;
    const wooProducts = await res.json();
    if (!wooProducts.length) break;

    for (const wp of wooProducts) {
      const supaP = supaWooMap.get(wp.id);
      if (!supaP) continue;

      const wooPrice = parseFloat(wp.regular_price || wp.price) || 0;
      const wooSalePrice = parseFloat(wp.sale_price) || 0;
      const isOferta = wooSalePrice > 0 && wooSalePrice < wooPrice;

      // Update offer flag if changed
      if (supaP.oferta !== isOferta) {
        await supa.from("productos_padre").update({ oferta: isOferta }).eq("id", supaP.id);
        offersUpdated++;
      }

      // Update variation prices
      if (wp.type === "simple" && wp.sku) {
        const precioB2c = isOferta ? wooSalePrice : wooPrice;
        const precioComparar = isOferta ? wooPrice : null;

        const { error } = await supa.from("productos_variaciones")
          .update({ precio_b2c: precioB2c, precio_comparar: precioComparar })
          .eq("sku", wp.sku);

        if (error) errors.push(`${wp.sku}: ${error.message}`);
        else totalUpdated++;
      }
    }

    page++;
    if (wooProducts.length < 100) break;
  }

  return NextResponse.json({ totalUpdated, offersUpdated, errors: errors.slice(0, 10) });
}
