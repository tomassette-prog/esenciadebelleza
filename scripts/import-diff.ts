/**
 * scripts/import-diff.ts
 *
 * Compara WooCommerce vs Supabase y genera import_diff.json con:
 *   - nuevos:      productos en WooCommerce que NO están en Supabase
 *   - modificados: productos que existen en ambos pero con cambios
 *   - iguales:     sin cambios (solo se listan los slugs)
 *
 * Cada producto modificado incluye:
 *   - los campos que cambian (woo vs supabase)
 *   - "aplicar": false  ← el usuario lo pone a true para aprobar
 *
 * Uso:
 *   npm run import:woo:diff
 *
 * Luego edita import_diff.json y ejecuta:
 *   npm run import:woo:aplicar
 */

import * as dotenv from "dotenv";
import * as fs from "fs";
dotenv.config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import * as https from "https";
import { WOO_CAT_MAP } from "../lib/categorias";

const WOO_URL  = process.env.WOO_URL!;
const CK       = process.env.WOO_CONSUMER_KEY!;
const CS       = process.env.WOO_CONSUMER_SECRET!;
const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const PER_PAGE = 100;

const supabase = createClient(SUPA_URL, SUPA_KEY);

// ── Tipos ─────────────────────────────────────────────────────────────────────
interface WooProduct {
  id: number; name: string; slug: string;
  type: string; status: string;
  description: string; short_description: string;
  sku: string; price: string; regular_price: string; sale_price: string;
  stock_quantity: number | null; stock_status: string;
  categories: { id: number; name: string; slug: string; parent: number }[];
  images: { src: string }[];
}

interface DiffEntry {
  slug: string;
  nombre_woo: string;
  cambios: Record<string, { woo: unknown; supabase: unknown }>;
  aplicar: boolean;
}

interface DiffReport {
  generado: string;
  resumen: { nuevos: number; modificados: number; iguales: number };
  nuevos: { slug: string; nombre: string; aplicar: boolean }[];
  modificados: DiffEntry[];
  iguales: string[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function slugify(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function get(url: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const auth = Buffer.from(`${CK}:${CS}`).toString("base64");
    https.get(url, { headers: { Authorization: `Basic ${auth}` } }, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => { try { resolve(JSON.parse(data)); } catch (e) { reject(e); } });
    }).on("error", reject);
  });
}

async function fetchAllProducts(): Promise<WooProduct[]> {
  const all: WooProduct[] = [];
  let page = 1;
  while (true) {
    const url = `${WOO_URL}/wp-json/wc/v3/products?status=publish&per_page=${PER_PAGE}&page=${page}`;
    const batch = await get(url) as WooProduct[];
    if (!Array.isArray(batch) || batch.length === 0) break;
    all.push(...batch);
    process.stdout.write(`\r   Descargados: ${all.length}`);
    if (batch.length < PER_PAGE) break;
    page++;
  }
  console.log();
  return all;
}

function resolverCategoria(cats: WooProduct["categories"]): { categoria: string; subcategoria: string } {
  for (const cat of cats) {
    const mapped = WOO_CAT_MAP[cat.id];
    if (mapped) return mapped;
  }
  return { categoria: "peluqueria", subcategoria: "peluqueria-general" };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log("═══════════════════════════════════════════════════");
  console.log("  Esencia de Belleza — Diff WooCommerce vs Supabase");
  console.log("═══════════════════════════════════════════════════\n");

  // 1. Descargar WooCommerce
  console.log("① Descargando productos de WooCommerce…");
  const wooProductos = await fetchAllProducts();
  console.log(`   Total WooCommerce: ${wooProductos.length}`);

  // 2. Cargar Supabase completo (slug → datos)
  console.log("\n② Cargando catálogo de Supabase…");
  const supaMap = new Map<string, {
    nombre: string; categoria: string; subcategoria: string | null;
    imagen_principal_url: string | null; descripcion_general: string | null;
  }>();
  let offset = 0;
  while (true) {
    const { data } = await supabase
      .from("productos_padre")
      .select("slug, nombre, categoria, subcategoria, imagen_principal_url, descripcion_general")
      .range(offset, offset + 999);
    if (!data || data.length === 0) break;
    for (const r of data) supaMap.set(r.slug, r);
    if (data.length < 1000) break;
    offset += 1000;
  }
  console.log(`   Total Supabase: ${supaMap.size}`);

  // 3. Comparar
  console.log("\n③ Comparando…");
  const report: DiffReport = {
    generado: new Date().toISOString(),
    resumen: { nuevos: 0, modificados: 0, iguales: 0 },
    nuevos: [],
    modificados: [],
    iguales: [],
  };

  for (const p of wooProductos) {
    const slug = p.slug || slugify(p.name);
    const existing = supaMap.get(slug);
    const { categoria, subcategoria } = resolverCategoria(p.categories);

    if (!existing) {
      // Producto nuevo
      report.nuevos.push({ slug, nombre: p.name, aplicar: true });
      continue;
    }

    // Comparar campos relevantes
    const cambios: DiffEntry["cambios"] = {};

    const nombreWoo = p.name.trim();
    if (nombreWoo !== existing.nombre)
      cambios["nombre"] = { woo: nombreWoo, supabase: existing.nombre };

    if (categoria !== existing.categoria)
      cambios["categoria"] = { woo: categoria, supabase: existing.categoria };

    if (subcategoria !== (existing.subcategoria ?? ""))
      cambios["subcategoria"] = { woo: subcategoria, supabase: existing.subcategoria };

    const imagenWoo = p.images[0]?.src ?? null;
    if (imagenWoo !== existing.imagen_principal_url)
      cambios["imagen_principal_url"] = { woo: imagenWoo, supabase: existing.imagen_principal_url };

    const descWoo = (p.description || p.short_description || "").trim() || null;
    const descSupa = (existing.descripcion_general ?? "").trim() || null;
    if (descWoo !== descSupa)
      cambios["descripcion"] = { woo: descWoo ? descWoo.slice(0, 80) + "…" : null, supabase: descSupa ? descSupa.slice(0, 80) + "…" : null };

    if (Object.keys(cambios).length > 0) {
      report.modificados.push({ slug, nombre_woo: p.name, cambios, aplicar: false });
    } else {
      report.iguales.push(slug);
    }
  }

  report.resumen = {
    nuevos: report.nuevos.length,
    modificados: report.modificados.length,
    iguales: report.iguales.length,
  };

  // 4. Guardar
  const outPath = "import_diff.json";
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2), "utf-8");

  console.log("\n═══════════════════════════════════════════════════");
  console.log("  Diff completado");
  console.log(`  Nuevos      : ${report.resumen.nuevos}   → aplicar: true por defecto`);
  console.log(`  Modificados : ${report.resumen.modificados}   → aplicar: false (revisa y cambia a true)`);
  console.log(`  Sin cambios : ${report.resumen.iguales}`);
  console.log(`\n  Archivo: ${outPath}`);
  console.log("\n  Edita el archivo y luego ejecuta:");
  console.log("    npm run import:woo:aplicar");
  console.log("═══════════════════════════════════════════════════");
}

main().catch(err => { console.error("[ERROR]", err); process.exit(1); });
