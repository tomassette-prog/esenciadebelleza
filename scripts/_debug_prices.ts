import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

const envText = readFileSync(resolve(__dirname, "../.env.production.local"), "utf-8");
const env: Record<string, string> = {};
for (const l of envText.split("\n")) {
  const i = l.indexOf("=");
  if (i > 0) env[l.slice(0, i)] = l.slice(i + 1).replace(/^["']|["']$/g, "");
}

const s = createClient(env["NEXT_PUBLIC_SUPABASE_URL"]!, env["SUPABASE_SERVICE_ROLE_KEY"]!);

async function main() {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Get recent products
  const { data: recent } = await s
    .from("productos_padre")
    .select("id, nombre, categoria, subcategoria")
    .gt("created_at", since)
    .limit(5000);

  console.log(`Productos creados últimos 30 días: ${recent?.length ?? 0}`);

  // Sample 20 to check variations
  const sample = (recent ?? []).slice(0, 20);
  let conVars = 0;
  let sinVars = 0;
  let precioCero = 0;

  for (const p of sample) {
    const { data: v } = await s
      .from("productos_variaciones")
      .select("precio_b2c, sku, stock")
      .eq("producto_padre_id", p.id);
    if (!v || v.length === 0) {
      sinVars++;
      console.log(`  ❌ SIN VARS: ${p.nombre.substring(0, 60)} | ${p.categoria}/${p.subcategoria}`);
    } else if (!v[0].precio_b2c || v[0].precio_b2c <= 0) {
      precioCero++;
      console.log(`  ⚠️ PRECIO 0: ${p.nombre.substring(0, 60)} | ${p.categoria}/${p.subcategoria} | SKU: ${v[0].sku}`);
    } else {
      conVars++;
    }
  }

  console.log(`\n=== MUESTRA 20 productos ===`);
  console.log(`Con variaciones y precio: ${conVars}`);
  console.log(`Sin variaciones: ${sinVars}`);
  console.log(`Precio 0: ${precioCero}`);

  // Count ALL recent without price
  let totalSinPrecio = 0;
  for (const p of recent ?? []) {
    const { data: v } = await s.from("productos_variaciones").select("precio_b2c").eq("producto_padre_id", p.id).limit(1);
    if (!v || v.length === 0 || !v[0].precio_b2c || v[0].precio_b2c <= 0) totalSinPrecio++;
  }
  console.log(`\nTOTAL sin precio (últimos 30d): ${totalSinPrecio} de ${recent?.length ?? 0}`);
}

main().catch(console.error);

