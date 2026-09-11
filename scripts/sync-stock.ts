/**
 * sync-stock.ts
 * 
 * Sincroniza stock desde WooCommerce a Supabase.
 * Lee todos los productos de WC (paginado) y actualiza stock + activa en Supabase.
 * 
 * Uso: npx ts-node scripts/sync-stock.ts
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

const WOO_URL = process.env.WOO_URL!;
const CK = process.env.WOO_CONSUMER_KEY!;
const CS = process.env.WOO_CONSUMER_SECRET!;
const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!WOO_URL || !CK || !CS || !SUPA_URL || !SUPA_KEY) {
  console.error("[ERROR] Faltan variables de entorno. Revisa .env.local");
  process.exit(1);
}

const supabase = createClient(SUPA_URL, SUPA_KEY);
const wooAuth = Buffer.from(`${CK}:${CS}`).toString("base64");

// ── Fetch WooCommerce products (paginated) ───────────────────────────────────
async function fetchWooPage(page: number): Promise<any[]> {
  const res = await fetch(
    `${WOO_URL}/wp-json/wc/v3/products?per_page=100&page=${page}&status=publish`,
    { headers: { Authorization: `Basic ${wooAuth}` } }
  );
  if (!res.ok) throw new Error(`WooCommerce ${res.status}: ${res.statusText}`);
  return res.json();
}

// ── Fetch variations for a variable product ──────────────────────────────────
async function fetchVariations(productId: number): Promise<any[]> {
  const res = await fetch(
    `${WOO_URL}/wp-json/wc/v3/products/${productId}/variations?per_page=100`,
    { headers: { Authorization: `Basic ${wooAuth}` } }
  );
  if (!res.ok) return [];
  return res.json();
}

async function main() {
  console.log("=== Sync de Stock: WooCommerce → Supabase ===\n");

  // 1. Cargar todos los productos de Supabase indexados por woo_id y sku
  console.log("Cargando productos de Supabase...");
  const { data: padres } = await supabase
    .from("productos_padre")
    .select("id, woo_id, slug")
    .eq("activo", true);

  const wooIdMap = new Map<number, string>(); // woo_id -> padre_id
  for (const p of padres ?? []) {
    if (p.woo_id) wooIdMap.set(p.woo_id, p.id);
  }

  const { data: variaciones } = await supabase
    .from("productos_variaciones")
    .select("id, producto_padre_id, sku, stock, activa");

  const skuMap = new Map<string, { id: string; producto_padre_id: string; stock: number; activa: boolean }>();
  for (const v of variaciones ?? []) {
    if (v.sku) skuMap.set(v.sku, v);
  }

  console.log(`  ${padres?.length ?? 0} padres, ${variaciones?.length ?? 0} variaciones\n`);

  // 2. Recorrer WooCommerce página por página
  let page = 1;
  let totalActualizados = 0;
  let totalSinCambio = 0;
  let totalNoEncontrados = 0;
  const errores: string[] = [];

  while (true) {
    console.log(`Descargando WC página ${page}...`);
    const batch = await fetchWooPage(page);
    if (!Array.isArray(batch) || batch.length === 0) break;
    console.log(`  ${batch.length} productos recibidos`);

    for (const wp of batch) {
      try {
        if (wp.type === "variable") {
          // Producto variable → actualizar cada variación
          const padreId = wooIdMap.get(wp.id);
          if (!padreId) { totalNoEncontrados++; continue; }

          const wcVars = await fetchVariations(wp.id);
          for (const wv of wcVars) {
            if (!wv.sku) continue;
            const supaVar = skuMap.get(wv.sku);
            if (!supaVar || supaVar.producto_padre_id !== padreId) continue;

            const wcStock = wv.stock_quantity ?? 0;
            const wcActiva = wv.stock_status !== "outofstock";

            if (supaVar.stock !== wcStock || supaVar.activa !== wcActiva) {
              const { error } = await supabase
                .from("productos_variaciones")
                .update({ stock: wcStock, activa: wcActiva })
                .eq("id", supaVar.id);
              if (error) errores.push(`${wv.sku}: ${error.message}`);
              else totalActualizados++;
            } else {
              totalSinCambio++;
            }
          }
        } else {
          // Producto simple → actualizar por SKU
          if (!wp.sku) continue;
          const supaVar = skuMap.get(wp.sku);
          if (!supaVar) { totalNoEncontrados++; continue; }

          const wcStock = wp.stock_quantity ?? 0;
          const wcActiva = wp.stock_status !== "outofstock";

          if (supaVar.stock !== wcStock || supaVar.activa !== wcActiva) {
            const { error } = await supabase
              .from("productos_variaciones")
              .update({ stock: wcStock, activa: wcActiva })
              .eq("id", supaVar.id);
            if (error) errores.push(`${wp.sku}: ${error.message}`);
            else totalActualizados++;
          } else {
            totalSinCambio++;
          }
        }
      } catch (e: any) {
        errores.push(`${wp.name}: ${e.message}`);
      }
    }

    if (batch.length < 100) break;
    page++;
  }

  // 3. Resumen
  console.log("\n=== RESUMEN ===");
  console.log(`  Stock actualizado:  ${totalActualizados}`);
  console.log(`  Sin cambios:        ${totalSinCambio}`);
  console.log(`  No encontrados:     ${totalNoEncontrados}`);
  if (errores.length > 0) {
    console.log(`  Errores:            ${errores.length}`);
    errores.slice(0, 10).forEach(e => console.log(`    - ${e}`));
    if (errores.length > 10) console.log(`    ... y ${errores.length - 10} más`);
  }
  console.log("\n¡Listo!");
}

main().catch(e => { console.error("Error fatal:", e); process.exit(1); });
