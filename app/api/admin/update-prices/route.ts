// Direct price update from diff data - no WooCommerce fetch needed
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function POST(req: Request) {
  const { changes } = await req.json();
  
  if (!changes?.length) {
    return NextResponse.json({ error: "No changes provided" }, { status: 400 });
  }

  const supa = adminClient();
  let updated = 0;
  const errors: string[] = [];

  for (const change of changes) {
    const { slug, wooPrice, wooSalePrice, isOferta } = change;
    
    // Update offer flag
    if (typeof isOferta === "boolean") {
      await supa.from("productos_padre").update({ oferta: isOferta }).eq("slug", slug);
    }

    // Update variation prices
    const precioB2c = isOferta ? wooSalePrice : wooPrice;
    const precioComparar = isOferta ? wooPrice : null;

    // Find the product's variations
    const { data: producto } = await supa
      .from("productos_padre")
      .select("id")
      .eq("slug", slug)
      .single();

    if (producto) {
      const { error } = await supa.from("productos_variaciones")
        .update({ precio_b2c: precioB2c, precio_comparar: precioComparar })
        .eq("producto_padre_id", producto.id)
        .eq("activa", true);

      if (error) errors.push(`${slug}: ${error.message}`);
      else updated++;
    }
  }

  return NextResponse.json({ updated, errors: errors.slice(0, 10) });
}
