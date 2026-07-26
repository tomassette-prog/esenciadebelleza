/**
 * scripts/backfill-woo-id.ts
 *
 * Backfill de `productos_padre.woo_id` (migración 020) para productos que
 * fueron importados desde WooCommerce antes de que existiera esa columna.
 *
 * Estrategia de matching (en orden de prioridad):
 *   1. Por SKU  → WC product.sku (simple) o WC variation.sku (variable)
 *                 contra `productos_variaciones.sku` → producto_padre_id
 *   2. Por slug → WC product.slug (normalizado) contra `productos_padre.slug`
 *   3. Por nombre → nombre normalizado (minúsculas, sin acentos, sin espacios extra)
 *
 * Idempotente: solo actualiza productos con `woo_id IS NULL`. Se puede
 * ejecutar varias veces sin riesgo.
 *
 * Uso: npm run backfill:woo-id
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env.production.local" }); // fallback si .env.local no trae las claves

import { createClient } from "@supabase/supabase-js";
import * as https from "https";

// ── Config ──────────────────────────────────────────────────────────────────
const WOO_URL  = process.env.WOO_URL!;
const CK       = process.env.WOO_CONSUMER_KEY!;
const CS       = process.env.WOO_CONSUMER_SECRET!;
const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const PER_PAGE   = 100; // máximo permitido por WooCommerce API
const PAGE_DELAY = 2000; // ms entre páginas de productos (anti rate-limit)
const VAR_DELAY  = 300;  // ms entre peticiones de variaciones
const BATCH      = 50;   // filas por lote de actualización en Supabase

if (!WOO_URL || !CK || !CS || !SUPA_URL || !SUPA_KEY) {
  console.error("[ERROR] Faltan variables de entorno (WOO_URL / WOO_CONSUMER_KEY / WOO_CONSUMER_SECRET / NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).");
  console.error("        Revisa .env.local o .env.production.local");
  process.exit(1);
}

const supabase = createClient(SUPA_URL, SUPA_KEY);

// ── Tipos WooCommerce ─────────────────────────────────────────────────────────
interface WooProduct {
  id: number;
  name: string;
  slug: string;
  type: "simple" | "variable" | "grouped" | "external";
  sku: string;
  variations: number[];
}

interface WooVariation {
  id: number;
  sku: string;
}

// ── Tipos Supabase (subset) ───────────────────────────────────────────────────
interface ProductoPadreRow {
  id: string;
  nombre: string;
  slug: string;
  woo_id: number | null;
}

interface VariacionRow {
  id: string;
  producto_padre_id: string;
  sku: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizarNombre(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function fetchJson<T>(url: string, intento = 1): Promise<T> {
  return new Promise((resolve, reject) => {
    const auth = Buffer.from(`${CK}:${CS}`).toString("base64");
    const urlObj = new URL(url);
    const opts = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      headers: {
        Authorization: `Basic ${auth}`,
        "User-Agent": "Mozilla/5.0 (compatible; EsenciaBellezaBackfill/1.0)",
        Accept: "application/json",
      },
    };
    const req = https.get(opts, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", async () => {
        const body = Buffer.concat(chunks).toString("utf8");
        if ((res.statusCode === 503 || res.statusCode === 429) && intento <= 5) {
          const espera = intento * 3000;
          console.log(`  [${res.statusCode}] Servidor ocupado, reintento ${intento}/5 en ${espera / 1000}s...`);
          await new Promise(r => setTimeout(r, espera));
          fetchJson<T>(url, intento + 1).then(resolve).catch(reject);
          return;
        }
        try {
          resolve(JSON.parse(body));
        } catch {
          if (intento <= 5) {
            const espera = intento * 4000;
            console.log(`  [JSON] Respuesta truncada, reintento ${intento}/5 en ${espera / 1000}s...`);
            await new Promise(r => setTimeout(r, espera));
            fetchJson<T>(url, intento + 1).then(resolve).catch(reject);
          } else {
            reject(new Error(`JSON parse error (status ${res.statusCode}): ${body.slice(0, 200)}`));
          }
        }
      });
    });
    req.on("error", async (err) => {
      if (intento <= 5) {
        const espera = intento * 3000;
        console.log(`  [ERR] ${err.message}, reintento ${intento}/5 en ${espera / 1000}s...`);
        await new Promise(r => setTimeout(r, espera));
        fetchJson<T>(url, intento + 1).then(resolve).catch(reject);
      } else {
        reject(err);
      }
    });
    req.setTimeout(45000, () => {
      req.destroy();
      if (intento <= 5) {
        const espera = intento * 3000;
        console.log(`  [TIMEOUT] Reintento ${intento}/5 en ${espera / 1000}s...`);
        setTimeout(() => fetchJson<T>(url, intento + 1).then(resolve).catch(reject), espera);
      } else {
        reject(new Error("Timeout tras 5 intentos"));
      }
    });
  });
}

async function fetchAllWooProducts(): Promise<WooProduct[]> {
  const all: WooProduct[] = [];
  let page = 1;
  while (true) {
    const url = `${WOO_URL}/wp-json/wc/v3/products?status=publish&per_page=${PER_PAGE}&page=${page}`;
    console.log(`  Página ${page} → fetching...`);
    const batch = await fetchJson<WooProduct[]>(url);
    if (!Array.isArray(batch) || batch.length === 0) break;
    all.push(...batch);
    console.log(`  └─ ${batch.length} productos (total: ${all.length})`);
    if (batch.length < PER_PAGE) break;
    page++;
    await new Promise(r => setTimeout(r, PAGE_DELAY));
  }
  return all;
}

async function fetchVariationSkus(productId: number): Promise<string[]> {
  const url = `${WOO_URL}/wp-json/wc/v3/products/${productId}/variations?per_page=100`;
  try {
    const vars = await fetchJson<WooVariation[]>(url);
    return Array.isArray(vars) ? vars.map(v => v.sku).filter(Boolean) : [];
  } catch (e) {
    console.warn(`  [WARN] No se pudieron obtener variaciones de WC #${productId}: ${(e as Error).message}`);
    return [];
  }
}

/** Fetch de todas las filas de una tabla Supabase paginando de a 1000 (límite de PostgREST). */
async function fetchAllRows<T>(table: string, columns: string): Promise<T[]> {
  const all: T[] = [];
  const pageSize = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`Error leyendo ${table}: ${error.message}`);
    if (!data || data.length === 0) break;
    all.push(...(data as unknown as T[]));
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log("=== Backfill woo_id: Supabase ⟷ WooCommerce ===\n");

  console.log("[1/5] Cargando productos_padre y productos_variaciones desde Supabase...");
  const [padres, variaciones] = await Promise.all([
    fetchAllRows<ProductoPadreRow>("productos_padre", "id, nombre, slug, woo_id"),
    fetchAllRows<VariacionRow>("productos_variaciones", "id, producto_padre_id, sku"),
  ]);
  console.log(`  └─ ${padres.length} productos_padre, ${variaciones.length} variaciones\n`);

  // Índices en memoria
  const skuToParentId = new Map<string, string>();
  for (const v of variaciones) {
    if (v.sku) skuToParentId.set(v.sku.trim().toLowerCase(), v.producto_padre_id);
  }

  const slugToPadre = new Map<string, ProductoPadreRow>();
  const nombreToPadre = new Map<string, ProductoPadreRow>();
  const padreById = new Map<string, ProductoPadreRow>();
  for (const p of padres) {
    padreById.set(p.id, p);
    slugToPadre.set(slugify(p.slug), p);
    const nombreKey = normalizarNombre(p.nombre);
    if (!nombreToPadre.has(nombreKey)) nombreToPadre.set(nombreKey, p);
  }

  console.log("[2/5] Descargando productos de WooCommerce...");
  const wooProducts = await fetchAllWooProducts();
  console.log(`Fetched ${wooProducts.length} WC products\n`);

  console.log("[3/5] Emparejando productos WC ⟷ Supabase...");
  let bySku = 0;
  let bySlug = 0;
  let byName = 0;
  let yaTenianWooId = 0;
  const updates = new Map<string, number>(); // producto_padre_id -> woo_id
  const unmatched: { id: number; name: string; slug: string; sku: string }[] = [];

  for (const wp of wooProducts) {
    let matchedPadre: ProductoPadreRow | undefined;
    let metodo: "sku" | "slug" | "nombre" | undefined;

    // 1) Por SKU (simple o variaciones)
    const skusCandidatos: string[] = [];
    if (wp.sku) skusCandidatos.push(wp.sku);
    if (wp.type === "variable" && wp.variations?.length) {
      const varSkus = await fetchVariationSkus(wp.id);
      skusCandidatos.push(...varSkus);
      await new Promise(r => setTimeout(r, VAR_DELAY));
    }
    for (const sku of skusCandidatos) {
      const parentId = skuToParentId.get(sku.trim().toLowerCase());
      if (parentId) {
        matchedPadre = padreById.get(parentId);
        metodo = "sku";
        break;
      }
    }

    // 2) Por slug
    if (!matchedPadre) {
      const padre = slugToPadre.get(slugify(wp.slug));
      if (padre) {
        matchedPadre = padre;
        metodo = "slug";
      }
    }

    // 3) Por nombre normalizado
    if (!matchedPadre) {
      const padre = nombreToPadre.get(normalizarNombre(wp.name));
      if (padre) {
        matchedPadre = padre;
        metodo = "nombre";
      }
    }

    if (!matchedPadre) {
      unmatched.push({ id: wp.id, name: wp.name, slug: wp.slug, sku: wp.sku });
      continue;
    }

    if (matchedPadre.woo_id !== null && matchedPadre.woo_id !== undefined) {
      yaTenianWooId++;
      continue;
    }

    if (updates.has(matchedPadre.id)) {
      // Ya se marcó en esta misma corrida (dos productos WC distintos matchean al mismo padre)
      continue;
    }

    updates.set(matchedPadre.id, wp.id);
    if (metodo === "sku") bySku++;
    else if (metodo === "slug") bySlug++;
    else byName++;
  }

  console.log(`Matched ${bySku} por SKU, ${bySlug} por slug, ${byName} por nombre`);
  console.log(`  └─ ${yaTenianWooId} ya tenían woo_id (omitidos, script idempotente)`);
  console.log(`  └─ ${unmatched.length} sin match\n`);

  console.log("[4/5] Actualizando productos_padre en Supabase...");
  const pares = Array.from(updates.entries()).map(([id, woo_id]) => ({ id, woo_id }));
  let actualizados = 0;
  for (let i = 0; i < pares.length; i += BATCH) {
    const chunk = pares.slice(i, i + BATCH);
    const { error } = await supabase
      .from("productos_padre")
      .upsert(chunk, { onConflict: "id" });
    if (error) {
      console.error(`  [ERROR] Lote ${i / BATCH + 1}: ${error.message}`);
      continue;
    }
    actualizados += chunk.length;
    console.log(`  └─ Lote ${Math.floor(i / BATCH) + 1}: ${chunk.length} productos actualizados (total: ${actualizados})`);
  }
  console.log(`Updated ${actualizados} products\n`);

  console.log("[5/5] Resumen final");
  console.log("═══════════════════════════════════════════════");
  console.log(`  WC products fetched:        ${wooProducts.length}`);
  console.log(`  Matched por SKU:            ${bySku}`);
  console.log(`  Matched por slug:           ${bySlug}`);
  console.log(`  Matched por nombre:         ${byName}`);
  console.log(`  Ya tenían woo_id:           ${yaTenianWooId}`);
  console.log(`  Actualizados en Supabase:   ${actualizados}`);
  console.log(`  Sin match:                  ${unmatched.length}`);
  console.log("═══════════════════════════════════════════════");

  if (unmatched.length > 0) {
    console.log("\n⚠️  Productos WC sin match (revisar manualmente):");
    for (const u of unmatched) {
      console.log(`  - WC#${u.id} | sku="${u.sku || "-"}" | slug="${u.slug}" | nombre="${u.name}"`);
    }
  }
}

main()
  .then(() => {
    console.log("\n✅ Backfill completado.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("\n❌ Error fatal en el backfill:", err);
    process.exit(1);
  });
