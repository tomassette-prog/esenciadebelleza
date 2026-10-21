import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { estaAutorizado } from "@/lib/cron-auth";

export const maxDuration = 60;

/**
 * Diagnostic: shows the meta_data keys WooCommerce actually returns for a few
 * products, so GTIN/EAN mapping (lib/woo-ean.ts) can be verified against real
 * supplier data instead of guessed.
 */
export async function GET(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  if (!(await estaAutorizado(req, supabase))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const auth = Buffer.from(`${process.env.WOO_CONSUMER_KEY}:${process.env.WOO_CONSUMER_SECRET}`).toString("base64");
  const res = await fetch(
    `${process.env.WOO_URL}/wp-json/wc/v3/products?per_page=50&status=publish&_fields=id,sku,name,meta_data`,
    { headers: { Authorization: `Basic ${auth}` }, cache: "no-store" }
  );
  if (!res.ok) {
    return NextResponse.json({ error: `WooCommerce ${res.status}` }, { status: 502 });
  }
  const products = (await res.json()) as Array<{
    id: number; sku: string; name: string;
    meta_data?: Array<{ key: string; value: unknown }>;
  }>;

  const patronGtin = /ean|gtin|barcode|isbn|mpn|codigo|barras/i;
  const claves = new Set<string>();
  const conGtin: Array<{ id: number; name: string; pares: Record<string, string> }> = [];
  for (const p of products) {
    const pares: Record<string, string> = {};
    for (const m of p.meta_data ?? []) {
      claves.add(m.key);
      if (patronGtin.test(m.key)) pares[m.key] = String(m.value ?? "").slice(0, 40);
    }
    if (Object.keys(pares).length) conGtin.push({ id: p.id, name: p.name, pares });
  }

  return NextResponse.json({
    productos_escaneados: products.length,
    productos_con_clave_gtin: conGtin.length,
    ejemplos: conGtin.slice(0, 5),
    todas_las_claves: [...claves].sort(),
  });
}
