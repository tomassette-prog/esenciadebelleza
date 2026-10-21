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
    `${process.env.WOO_URL}/wp-json/wc/v3/products?per_page=3&status=publish&_fields=id,sku,name,meta_data`,
    { headers: { Authorization: `Basic ${auth}` }, cache: "no-store" }
  );
  if (!res.ok) {
    return NextResponse.json({ error: `WooCommerce ${res.status}` }, { status: 502 });
  }
  const products = (await res.json()) as Array<{
    id: number; sku: string; name: string;
    meta_data?: Array<{ key: string; value: unknown }>;
  }>;

  return NextResponse.json(
    products.map((p) => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      meta: (p.meta_data ?? []).map((m) => ({ key: m.key, value: String(m.value ?? "").slice(0, 60) })),
    }))
  );
}
