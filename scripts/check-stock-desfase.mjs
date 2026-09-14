/**
 * Script diagnóstico: compara stock entre Supabase (Esencia) y WooCommerce (Depeluqueria)
 * 
 * Productos con stock > 0 en Esencia pero outofstock en Depeluqueria.
 * 
 * Uso: node scripts/check-stock-desfase.mjs [--fix] [--limit N]
 *   --fix   Actualiza stock en WC para coincidir con Supabase
 *   --limit N  Limita a N productos (default: 50)
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

// ── Load env from .env.local ONLY if essential vars are missing ──
const __dirname = dirname(fileURLToPath(import.meta.url));
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.WOO_URL) {
  try {
    const envContent = readFileSync(join(__dirname, "..", ".env.local"), "utf8");
    envContent.split(/\r?\n/).forEach((line) => {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)="?([^"]*)"?/);
      if (m && m[2]) process.env[m[1]] = m[2];
    });
  } catch { /* no .env.local */ }
}

const args = process.argv.slice(2);
const FIX = args.includes("--fix");
const limitIdx = args.indexOf("--limit");
const LIMIT = limitIdx >= 0 ? parseInt(args[limitIdx + 1], 10) : 200;

// ── Env ──
const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const WOO_URL = process.env.WOO_URL;
const WOO_CK = process.env.WOO_CONSUMER_KEY;
const WOO_CS = process.env.WOO_CONSUMER_SECRET;

if (!SUPA_URL || !SUPA_KEY || !WOO_URL || !WOO_CK || !WOO_CS) {
  console.error("❌ Faltan variables de entorno en .env.local:");
  if (!SUPA_URL) console.error("   - NEXT_PUBLIC_SUPABASE_URL");
  if (!SUPA_KEY) console.error("   - SUPABASE_SERVICE_ROLE_KEY");
  if (!WOO_URL) console.error("   - WOO_URL");
  if (!WOO_CK) console.error("   - WOO_CONSUMER_KEY");
  if (!WOO_CS) console.error("   - WOO_CONSUMER_SECRET");
  process.exit(1);
}

const authHeader = "Basic " + Buffer.from(`${WOO_CK}:${WOO_CS}`).toString("base64");

async function wooFetch(path) {
  const res = await fetch(`${WOO_URL}/wp-json/wc/v3${path}`, {
    headers: { Authorization: authHeader },
  });
  if (!res.ok) throw new Error(`WooCommerce ${res.status}: ${path}`);
  return res.json();
}

async function wooUpdate(productId, data) {
  const res = await fetch(`${WOO_URL}/wp-json/wc/v3/products/${productId}`, {
    method: "PUT",
    headers: { Authorization: authHeader, "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`WooCommerce PUT ${res.status}: ${text}`);
  }
  return res.json();
}

async function wooUpdateVariation(productId, variationId, data) {
  const res = await fetch(`${WOO_URL}/wp-json/wc/v3/products/${productId}/variations/${variationId}`, {
    method: "PUT",
    headers: { Authorization: authHeader, "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`WooCommerce PUT var ${res.status}: ${text}`);
  }
  return res.json();
}

async function wooFetchPages(path) {
  // Fetch all pages of a WC query, max 100 per page
  let page = 1;
  const all = [];
  while (true) {
    const sep = path.includes("?") ? "&" : "?";
    const data = await wooFetch(`${path}${sep}per_page=100&page=${page}`);
    if (!Array.isArray(data) || data.length === 0) break;
    all.push(...data);
    if (data.length < 100) break;
    page++;
    await new Promise(r => setTimeout(r, 200));
  }
  return all;
}

async function wooFetchPagesForProduct(productId) {
  // Fetch all variation pages for a single product
  let page = 1;
  const all = [];
  while (true) {
    const data = await wooFetch(`/products/${productId}/variations?per_page=100&page=${page}&_fields=id,sku,stock_status,manage_stock,stock_quantity`);
    if (!Array.isArray(data) || data.length === 0) break;
    all.push(...data);
    if (data.length < 100) break;
    page++;
  }
  return all;
}

async function main() {
  console.log(`\n🔍 Buscando desfase de stock: Esencia (Supabase) vs Depeluqueria (WooCommerce)\n`);
  console.log(`   Modo: ${FIX ? "🔧 FIX (actualizará WC)" : "👁️  Solo lectura"}\n`);

  // 1. Get all outofstock products from WC in bulk
  console.log("⏳ Obteniendo productos outofstock de WooCommerce...");
  const wcOutOfStock = await wooFetchPages("/products?stock_status=outofstock&_fields=id,type,sku,stock_status,manage_stock,stock_quantity,variations,name");
  console.log(`   📊 ${wcOutOfStock.length} productos outofstock en WC\n`);

  // Build a lookup: woo_id -> product
  const wcOosMap = new Map();
  for (const p of wcOutOfStock) {
    wcOosMap.set(String(p.id), p);
  }

  // Also build a set of outofstock simple product SKUs
  const wcOosSimpleSkus = new Set();
  for (const p of wcOutOfStock) {
    if (p.type === "simple" && p.sku) wcOosSimpleSkus.add(p.sku);
  }

  // For variable products, we need to check their variations
  // Collect variable product IDs that might match our Supabase data
  const wcVariableOosIds = new Set();
  for (const p of wcOutOfStock) {
    if (p.type === "variable") wcVariableOosIds.add(p.id);
  }

  // 2. Get products with stock > 0 from Supabase
  console.log("⏳ Consultando Supabase...");
  const supa = createClient(SUPA_URL, SUPA_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: variaciones, error } = await supa
    .from("productos_variaciones")
    .select(`
      id, sku, nombre_variacion, stock, activa,
      producto_padre_id,
      productos_padre!inner(id, woo_id, nombre, activo)
    `)
    .gt("stock", 0)
    .lt("stock", 9999)
    .eq("activa", true)
    .eq("productos_padre.activo", true)
    .not("productos_padre.woo_id", "is", null);

  if (error) {
    console.error("❌ Error Supabase:", error.message);
    process.exit(1);
  }

  console.log(`   📊 ${variaciones.length} variaciones con stock > 0 en Supabase\n`);

  // 3. Cross-reference: find Supabase products that are outofstock in WC
  const desfases = [];

  // 3a. Check simple products first (fast — just SKU lookup)
  for (const v of variaciones) {
    const wooId = v.productos_padre.woo_id;
    const wcProduct = wcOosMap.get(String(wooId));
    if (!wcProduct) continue;

    if (wcProduct.type === "simple") {
      desfases.push({
        tipo: "simple",
        woo_id: wooId,
        nombre: v.productos_padre.nombre,
        sku: v.sku,
        supabase_stock: v.stock,
        wc_stock_status: "outofstock",
        variacion_id: v.id,
        wc_product_id: wooId,
      });
    }
  }

  // 3b. For variable products, check variations by SKU
  // Group Supabase variaciones by woo_id for variable products
  const varByWooId = new Map();
  for (const v of variaciones) {
    const wooId = v.productos_padre.woo_id;
    if (!wcOosMap.has(String(wooId))) continue;
    const wcProduct = wcOosMap.get(String(wooId));
    if (wcProduct.type !== "variable") continue;
    if (!varByWooId.has(wooId)) varByWooId.set(wooId, []);
    varByWooId.get(wooId).push(v);
  }

  console.log(`   🔍 Verificando ${varByWooId.size} productos variables outofstock...`);

  let varChecked = 0;
  for (const [wooId, vars] of varByWooId) {
    try {
      const wcVars = await wooFetchPagesForProduct(wooId);

      for (const supaVar of vars) {
        const wcVar = wcVars.find(wv => wv.sku === supaVar.sku);
        if (wcVar && wcVar.stock_status === "outofstock") {
          desfases.push({
            tipo: "variable",
            woo_id: wooId,
            nombre: supaVar.productos_padre.nombre,
            sku: supaVar.sku,
            variacion: supaVar.nombre_variacion,
            supabase_stock: supaVar.stock,
            wc_stock_status: "outofstock",
            variacion_id: supaVar.id,
            wc_product_id: wooId,
            wc_variation_id: wcVar.id,
          });
        }
      }

      varChecked++;
      if (varChecked % 10 === 0) {
        process.stdout.write(`   Verificados ${varChecked}/${varByWooId.size}...\r`);
        await new Promise(r => setTimeout(r, 100));
      }
    } catch (err) {
      // skip
    }
  }

  // Sort by nombre
  desfases.sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));

  console.log(`\n${"─".repeat(70)}`);
  console.log(`\n📋 RESULTADOS: ${desfases.length} productos con stock en Esencia pero sin existencias en Depeluqueria\n`);

  if (desfases.length === 0) {
    console.log("✅ No hay desfase de stock entre ambos sistemas.");
    return;
  }

  // Mostrar tabla
  console.log("┌─" + "─".repeat(68) + "┐");
  for (const d of desfases.slice(0, 30)) {
    const tipo = d.tipo === "simple" ? "S" : "V";
    const nombre = d.nombre.substring(0, 40).padEnd(40);
    const sku = (d.sku || "-").substring(0, 15).padEnd(15);
    const stock = String(d.supabase_stock).padStart(5);
    const wcId = String(d.wc_product_id).padStart(8);
    console.log(`│ ${tipo} │ WC:${wcId} │ ${nombre} │ SKU:${sku} │ Stock:${stock} │`);
    if (d.variacion) {
      console.log(`│   │          │   ↳ ${d.variacion.substring(0, 36).padEnd(36)} │                │       │`);
    }
  }
  console.log("└─" + "─".repeat(68) + "┘");

  if (desfases.length > 30) {
    console.log(`\n   ... y ${desfases.length - 30} más.\n`);
  }

  // 4. FIX: Actualizar WC si se pidió
  if (FIX) {
    console.log(`\n🔧 Actualizando ${desfases.length} productos en WooCommerce...\n`);
    let fixed = 0;
    let fixErrors = 0;

    for (const d of desfases) {
      try {
        if (d.tipo === "simple") {
          await wooUpdate(d.wc_product_id, {
            stock_quantity: d.supabase_stock,
            stock_status: "instock",
            manage_stock: true,
          });
        } else {
          await wooUpdateVariation(d.wc_product_id, d.wc_variation_id, {
            stock_quantity: d.supabase_stock,
            stock_status: "instock",
            manage_stock: true,
          });
        }
        fixed++;
        if (fixed % 10 === 0) {
          console.log(`   ✅ ${fixed}/${desfases.length} actualizados...`);
        }
        // Pausa para no saturar WC
        await new Promise(r => setTimeout(r, 300));
      } catch (err) {
        fixErrors++;
        console.error(`   ❌ Error actualizando ${d.sku}: ${err.message}`);
      }
    }

    console.log(`\n✅ Corregidos: ${fixed} | ❌ Errores: ${fixErrors}`);
  } else {
    console.log(`\n💡 Ejecuta con --fix para actualizar el stock en WooCommerce.`);
  }
}

main().catch(err => {
  console.error("❌ Error fatal:", err);
  process.exit(1);
});
