/**
 * scripts/import-woo.ts
 * Importa productos desde WooCommerce REST API v3 directamente a Supabase.
 * Uso: npm run import:woo
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import * as https from "https";

// ── Config ────────────────────────────────────────────────────────────────────
const WOO_URL    = process.env.WOO_URL!;
const CK         = process.env.WOO_CONSUMER_KEY!;
const CS         = process.env.WOO_CONSUMER_SECRET!;
const SUPA_URL   = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPA_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BATCH      = 50;   // productos por lote en Supabase
const PER_PAGE   = 100;  // máximo permitido por WooCommerce API

if (!WOO_URL || !CK || !CS || !SUPA_URL || !SUPA_KEY) {
  console.error("[ERROR] Faltan variables de entorno. Revisa .env.local");
  process.exit(1);
}

const supabase = createClient(SUPA_URL, SUPA_KEY);

// ── Tipos WooCommerce ─────────────────────────────────────────────────────────
interface WooImage  { id: number; src: string; alt: string; }
interface WooCat    { id: number; name: string; slug: string; parent: number; }
interface WooAttrVal{ id: number; name: string; slug: string; }
interface WooAttr   { id: number; name: string; options: string[]; variation: boolean; }
interface WooMeta   { id: number; key: string; value: string; }

interface WooProduct {
  id: number;
  name: string;
  slug: string;
  type: "simple" | "variable" | "grouped" | "external";
  status: string;
  description: string;
  short_description: string;
  sku: string;
  price: string;
  regular_price: string;
  sale_price: string;
  stock_quantity: number | null;
  manage_stock: boolean;
  stock_status: "instock" | "outofstock" | "onbackorder";
  categories: WooCat[];
  images: WooImage[];
  attributes: WooAttr[];
  variations: number[];
  meta_data: WooMeta[];
}

interface WooVariation {
  id: number;
  sku: string;
  price: string;
  regular_price: string;
  sale_price: string;
  stock_quantity: number | null;
  stock_status: string;
  attributes: WooAttrVal[];
  image: WooImage | null;
  meta_data: WooMeta[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
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
        "User-Agent": "Mozilla/5.0 (compatible; EsenciaBellezaImport/1.0)",
        Accept: "application/json",
      },
    };
    const req = https.get(opts, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", async () => {
        const body = Buffer.concat(chunks).toString("utf8");
        // 503 o 429 → reintentar con backoff
        if ((res.statusCode === 503 || res.statusCode === 429) && intento <= 5) {
          const espera = intento * 3000;
          console.log(`  [503] Servidor ocupado, reintento ${intento}/5 en ${espera / 1000}s...`);
          await new Promise(r => setTimeout(r, espera));
          fetchJson<T>(url, intento + 1).then(resolve).catch(reject);
          return;
        }
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          // Respuesta truncada (200 pero JSON roto) → reintentar
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

async function fetchAllProducts(): Promise<WooProduct[]> {
  const all: WooProduct[] = [];
  let page = 1;
  while (true) {
    const url = `${WOO_URL}/wp-json/wc/v3/products?per_page=${PER_PAGE}&page=${page}&status=publish`;
    console.log(`  Pagina ${page} — ${url}`);
    const batch = await fetchJson<WooProduct[]>(url);
    if (!Array.isArray(batch) || batch.length === 0) break;
    all.push(...batch);
    console.log(`  -> ${batch.length} productos (total: ${all.length})`);
    if (batch.length < PER_PAGE) break;
    page++;
    await new Promise(r => setTimeout(r, 2000)); // respetar rate-limit del servidor
  }
  return all;
}

async function fetchVariations(productId: number): Promise<WooVariation[]> {
  const url = `${WOO_URL}/wp-json/wc/v3/products/${productId}/variations?per_page=100`;
  try {
    const vars = await fetchJson<WooVariation[]>(url);
    return Array.isArray(vars) ? vars : [];
  } catch {
    return [];
  }
}

// ── Mapa de marcas (cache) ────────────────────────────────────────────────────
const marcaCache = new Map<string, string>();

async function upsertMarca(nombre: string): Promise<string> {
  if (marcaCache.has(nombre)) return marcaCache.get(nombre)!;
  const slug = slugify(nombre);
  const { data, error } = await supabase
    .from("marcas")
    .upsert({ nombre, slug }, { onConflict: "slug" })
    .select("id")
    .single();
  if (error || !data) {
    console.warn(`  [WARN] Marca "${nombre}": ${error?.message}`);
    return "";
  }
  marcaCache.set(nombre, data.id);
  return data.id;
}

// ── Detección de marca por nombre de producto ─────────────────────────────────
const MARCAS_CONOCIDAS = [
  "L'Oréal","Loreal","Wella","Fanola","Schwarzkopf","Goldwell","Revlon","Kerastase",
  "Kerastase","Matrix","Redken","Joico","Kérastase","Olaplex","Alfaparf","Balmain",
  "Montibello","Risfort","Salerm","Celine","Periche","Keyra","Exitenn","Tahe",
];

function detectarMarca(nombre: string): string | null {
  for (const m of MARCAS_CONOCIDAS) {
    if (nombre.toLowerCase().includes(m.toLowerCase())) return m;
  }
  return null;
}

// ── Mapeo categoría WooCommerce → categoria/subcategoria ──────────────────────
function mapCategoria(cats: WooCat[]): { categoria: string; subcategoria: string } {
  // La categoria de mayor nivel (parent=0) es la principal
  const raiz = cats.find(c => c.parent === 0) ?? cats[0];
  const hija = cats.find(c => c.parent !== 0 && c.id !== raiz?.id) ?? null;
  return {
    categoria: raiz?.name ?? "General",
    subcategoria: hija?.name ?? raiz?.name ?? "General",
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log("Conectando con WooCommerce API...");
  console.log(`Tienda: ${WOO_URL}`);

  // 1. Obtener todos los productos publicados
  console.log("\nDescargando productos...");
  const productos = await fetchAllProducts();
  console.log(`\nTotal productos: ${productos.length}`);

  let importadosPadre = 0;
  let importadasVariaciones = 0;
  let errores = 0;

  // 2. Procesar en lotes
  for (let i = 0; i < productos.length; i += BATCH) {
    const lote = productos.slice(i, i + BATCH);
    const padresRows: object[] = [];
    const variacionesRows: object[] = [];

    for (const p of lote) {
      // ── Marca ──
      const marcaNombre = detectarMarca(p.name);
      const marcaId = marcaNombre ? await upsertMarca(marcaNombre) : null;

      const { categoria, subcategoria } = mapCategoria(p.categories);
      const slug = p.slug || slugify(p.name);

      // ── Producto padre ──
      const padre = {
        nombre:               p.name,
        slug,
        categoria,
        subcategoria,
        descripcion_general:  p.description || p.short_description || null,
        imagen_principal_url: p.images[0]?.src ?? null,
        marca_id:             marcaId || null,
        activo:               p.status === "publish",
        destacado:            false,
        nuevo:                false,
      };
      padresRows.push(padre);
    }

    // Upsert padres
    const { data: padresInsertados, error: errPadre } = await supabase
      .from("productos_padre")
      .upsert(padresRows, { onConflict: "slug" })
      .select("id, slug");

    if (errPadre) {
      console.error(`  [ERROR] Lote padres ${i}-${i + BATCH}: ${errPadre.message}`);
      errores++;
      continue;
    }

    importadosPadre += (padresInsertados ?? []).length;

    // Crear mapa slug → id
    const slugToId = new Map<string, string>(
      (padresInsertados ?? []).map(p => [p.slug, p.id])
    );

    // ── Variaciones ──
    for (const p of lote) {
      const padreId = slugToId.get(p.slug || slugify(p.name));
      if (!padreId) continue;

      if (p.type === "variable" && p.variations.length > 0) {
        // Descargar variaciones de WooCommerce
        const vars = await fetchVariations(p.id);
        await new Promise(r => setTimeout(r, 1000)); // pausa entre variaciones

        for (const v of vars) {
          const nombreVar = v.attributes.map(a => a.name).join(" / ") || "Unidad";
          const sku = v.sku || `${slugify(p.name)}-${v.id}`;
          const precio = parseFloat(v.regular_price || v.price) || 0;

          variacionesRows.push({
            producto_padre_id: padreId,
            nombre_variacion:  nombreVar,
            sku,
            precio_b2c:        precio,
            precio_b2b:        parseFloat((precio * 0.75).toFixed(2)),
            stock:             v.stock_quantity ?? 0,
            activa:            v.stock_status !== "outofstock",
            imagen_url:        v.image?.src ?? null,
          });
        }
      } else {
        // Producto simple → 1 variación "Unidad"
        const sku = p.sku || `${slugify(p.name)}-simple`;
        const precio = parseFloat(p.regular_price || p.price) || 0;

        variacionesRows.push({
          producto_padre_id: padreId,
          nombre_variacion:  "Unidad",
          sku,
          precio_b2c:        precio,
          precio_b2b:        parseFloat((precio * 0.75).toFixed(2)),
          stock:             p.stock_quantity ?? 0,
          activa:            p.stock_status !== "outofstock",
          imagen_url:        p.images[0]?.src ?? null,
        });
      }
    }

    if (variacionesRows.length > 0) {
      const { error: errVar } = await supabase
        .from("productos_variaciones")
        .upsert(variacionesRows, { onConflict: "sku" });

      if (errVar) {
        console.error(`  [ERROR] Variaciones lote ${i}: ${errVar.message}`);
        errores++;
      } else {
        importadasVariaciones += variacionesRows.length;
      }
    }

    console.log(`Lote ${i + 1}-${Math.min(i + BATCH, productos.length)}: ${padresRows.length} padres, ${variacionesRows.length} variaciones`);
  }

  console.log("\n--- Importacion completada ---");
  console.log(`Productos padre : ${importadosPadre}`);
  console.log(`Variaciones     : ${importadasVariaciones}`);
  console.log(`Errores         : ${errores}`);
}

main().catch(err => {
  console.error("[ERROR] Fatal:", err);
  process.exit(1);
});
