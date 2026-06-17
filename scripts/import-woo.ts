/**
 * scripts/import-woo.ts  (v2)
 *
 * Importa productos desde WooCommerce REST API v3 a Supabase.
 * Usa la taxonomía canónica definida en lib/categorias.ts.
 *
 * Mejoras v2:
 *   - Mapeo de categorías con resolución jerárquica (WOO_CAT_MAP)
 *   - SEO title + description autogenerados por plantilla de subcategoría
 *   - nombre_variacion usa el VALOR del atributo (ej: "7/0 Rubio Medio"),
 *     no el nombre (antes devolvía "Color" por error)
 *   - precio_comparar = regular_price cuando hay sale_price activo
 *   - imagen_url en variaciones: imagen propia o herencia del padre
 *   - Lista de marcas ampliada + detección case-insensitive
 *
 * Uso: npm run import:woo
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import * as https from "https";
import { WOO_CAT_MAP, SEO_TEMPLATES } from "../lib/categorias";

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

// En variaciones, "option" es el VALOR seleccionado (ej: "7/0 Rubio Medio")
interface WooAttrVal{ id: number; name: string; option: string; }

// En productos padre, "options" es la lista de valores posibles
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
  attributes: WooAttrVal[];   // ← cada atributo tiene "option" con el valor real
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

function truncar(texto: string, max: number): string {
  if (texto.length <= max) return texto;
  return texto.slice(0, max - 1).trim() + "…";
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
    console.log(`  Página ${page} → ${url}`);
    const batch = await fetchJson<WooProduct[]>(url);
    if (!Array.isArray(batch) || batch.length === 0) break;
    all.push(...batch);
    console.log(`  └─ ${batch.length} productos (total: ${all.length})`);
    if (batch.length < PER_PAGE) break;
    page++;
    await new Promise(r => setTimeout(r, 2000));
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

// ── Árbol de categorías WooCommerce (para resolución jerárquica) ───────────────
interface WooCatFull { id: number; parent: number; }
const catTree = new Map<number, WooCatFull>();

async function cargarCategorias(): Promise<void> {
  let page = 1;
  while (true) {
    const url = `${WOO_URL}/wp-json/wc/v3/products/categories?per_page=100&page=${page}`;
    const cats = await fetchJson<WooCatFull[]>(url);
    if (!Array.isArray(cats) || cats.length === 0) break;
    for (const c of cats) catTree.set(c.id, c);
    if (cats.length < 100) break;
    page++;
    await new Promise(r => setTimeout(r, 1000));
  }
  console.log(`  └─ ${catTree.size} categorías cargadas`);
}

/**
 * Resuelve la categoría canónica para un producto.
 * Busca primero en las categorías del producto; si no encuentra,
 * sube por la jerarquía padre → abuelo hasta profundidad 5.
 */
function resolverCategoria(wooCategories: WooCat[]): { categoria: string; subcategoria: string } {
  for (const cat of wooCategories) {
    if (WOO_CAT_MAP[cat.id]) return WOO_CAT_MAP[cat.id];
  }
  for (const cat of wooCategories) {
    let parentId = catTree.get(cat.id)?.parent ?? 0;
    let depth = 0;
    while (parentId > 0 && depth < 5) {
      if (WOO_CAT_MAP[parentId]) return WOO_CAT_MAP[parentId];
      parentId = catTree.get(parentId)?.parent ?? 0;
      depth++;
    }
  }
  return { categoria: "sin-clasificar", subcategoria: "sin-clasificar" };
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
  "L'Oréal","Loreal","Wella","Fanola","Schwarzkopf","Goldwell","Revlon",
  "Kérastase","Kerastase","Matrix","Redken","Joico","Olaplex","Alfaparf",
  "Balmain","Montibello","Risfort","Salerm","Celine","Periche","Keyra",
  "Exitenn","Tahe","Hipertin","Liheto","Glossco","Yunsey","Valquer",
  "Keen Strok","Hairtalk","Keler","Lendan","Arual","Vis Plantis","Dr. Sante",
  "Novon","Hey Joe","Kuul","Karseell","Cantu","Candelahn","Coiffer","Don Algodon",
];

function detectarMarca(nombre: string): string | null {
  const nombreLower = nombre.toLowerCase();
  // Ordenar de más largo a más corto para evitar coincidencias parciales
  const ordenadas = [...MARCAS_CONOCIDAS].sort((a, b) => b.length - a.length);
  for (const m of ordenadas) {
    if (nombreLower.includes(m.toLowerCase())) return m;
  }
  return null;
}

// ── Generación de SEO ─────────────────────────────────────────────────────────
function generarSeo(nombre: string, subcategoria: string) {
  const tpl = SEO_TEMPLATES[subcategoria] ?? SEO_TEMPLATES["default"];
  return {
    seo_title:       truncar(tpl.title.replace("{nombre}", nombre), 60),
    seo_description: truncar(tpl.desc.replace("{nombre}", nombre),  155),
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log("═══════════════════════════════════════════════════");
  console.log("  Esencia de Belleza — Importación WooCommerce v2");
  console.log(`  Tienda: ${WOO_URL}`);
  console.log("═══════════════════════════════════════════════════\n");

  // 1. Cargar categorías para resolución jerárquica
  console.log("① Cargando categorías de WooCommerce…");
  await cargarCategorias();

  // 2. Descargar todos los productos publicados
  console.log("\n② Descargando productos publicados…");
  const productos = await fetchAllProducts();
  console.log(`\n   Total productos: ${productos.length}`);

  let importadosPadre = 0;
  let importadasVariaciones = 0;
  let sinClasificar = 0;
  let errores = 0;

  // 3. Procesar en lotes de BATCH
  for (let i = 0; i < productos.length; i += BATCH) {
    const lote = productos.slice(i, i + BATCH);
    const padresRows: object[] = [];
    const variacionesPorSlug = new Map<string, object[]>();

    for (const p of lote) {
      // ── Marca ──────────────────────────────────────────────────────────────
      const marcaNombre = detectarMarca(p.name);
      const marcaId = marcaNombre ? await upsertMarca(marcaNombre) : null;

      // ── Taxonomía canónica ─────────────────────────────────────────────────
      const { categoria, subcategoria } = resolverCategoria(p.categories);
      if (categoria === "sin-clasificar") {
        sinClasificar++;
        console.warn(
          `  [SIN_CLASE] "${p.name}" → cats: ${p.categories.map(c => `${c.id}(${c.name})`).join(", ")}`
        );
      }

      // ── SEO ────────────────────────────────────────────────────────────────
      const { seo_title, seo_description } = generarSeo(p.name, subcategoria);

      const slug = p.slug || slugify(p.name);

      padresRows.push({
        nombre:               p.name,
        slug,
        categoria,
        subcategoria,
        descripcion_general:  p.description || p.short_description || null,
        imagen_principal_url: p.images[0]?.src ?? null,
        marca_id:             marcaId || null,
        seo_title,
        seo_description,
        activo:               true,
        destacado:            false,
        nuevo:                false,
      });

      if (p.type !== "variable") {
        // Producto simple → variación única "Unidad"
        const precioRegular = parseFloat(p.regular_price || p.price) || 0;
        const precioVenta   = parseFloat(p.sale_price) || 0;
        variacionesPorSlug.set(slug, [{
          nombre_variacion: "Unidad",
          sku:              p.sku || `${slug}-u`,
          precio_b2c:       precioRegular,
          precio_b2b:       parseFloat((precioRegular * 0.75).toFixed(2)),
          precio_comparar:  precioVenta > 0 && precioVenta < precioRegular ? precioRegular : null,
          stock:            p.stock_quantity ?? 0,
          activa:           p.stock_status !== "outofstock",
          imagen_url:       p.images[0]?.src ?? null,
        }]);
      }
      // Los variables se rellenan después con fetchVariations
    }

    // ── Upsert padres ──────────────────────────────────────────────────────────
    const { data: padresInsertados, error: errPadre } = await supabase
      .from("productos_padre")
      .upsert(padresRows, { onConflict: "slug" })
      .select("id, slug");

    if (errPadre) {
      console.error(`  [ERROR] Lote padres ${i}–${i + BATCH}: ${errPadre.message}`);
      errores++;
      continue;
    }

    importadosPadre += (padresInsertados ?? []).length;
    const slugToId = new Map<string, string>(
      (padresInsertados ?? []).map(p => [p.slug, p.id])
    );

    // ── Variaciones ────────────────────────────────────────────────────────────
    for (const p of lote) {
      const slug    = p.slug || slugify(p.name);
      const padreId = slugToId.get(slug);
      if (!padreId) continue;

      let filas: object[] = [];

      if (p.type === "variable" && p.variations.length > 0) {
        const vars = await fetchVariations(p.id);
        await new Promise(r => setTimeout(r, 800));

        for (const v of vars) {
          // CORRECCIÓN: usar v.attributes[x].option (valor), no .name (nombre del atributo)
          const nombreVar = v.attributes.length > 0
            ? v.attributes.map(a => a.option).filter(Boolean).join(" / ")
            : "Unidad";

          const precioRegular = parseFloat(v.regular_price || v.price) || 0;
          const precioVenta   = parseFloat(v.sale_price) || 0;

          filas.push({
            producto_padre_id: padreId,
            nombre_variacion:  nombreVar,
            sku:               v.sku || `${slug}-${v.id}`,
            precio_b2c:        precioRegular,
            precio_b2b:        parseFloat((precioRegular * 0.75).toFixed(2)),
            precio_comparar:   precioVenta > 0 && precioVenta < precioRegular ? precioRegular : null,
            stock:             v.stock_quantity ?? 0,
            activa:            v.stock_status !== "outofstock",
            // Imagen propia de la variación; si no tiene, hereda la del padre
            imagen_url:        v.image?.src ?? p.images[0]?.src ?? null,
          });
        }
      } else {
        filas = ((variacionesPorSlug.get(slug) ?? []) as Record<string, unknown>[]).map(f => ({
          ...f,
          producto_padre_id: padreId,
        }));
      }

      if (filas.length > 0) {
        const { error: errVar } = await supabase
          .from("productos_variaciones")
          .upsert(filas, { onConflict: "sku" });

        if (errVar) {
          console.error(`  [ERROR] Variaciones "${slug}": ${errVar.message}`);
          errores++;
        } else {
          importadasVariaciones += filas.length;
        }
      }
    }

    const hasta = Math.min(i + BATCH, productos.length);
    console.log(`  ✓ Lote ${i + 1}–${hasta}: ${padresRows.length} padres procesados`);
  }

  console.log("\n═══════════════════════════════════════════════════");
  console.log("  Importación completada");
  console.log(`  Productos padre : ${importadosPadre}`);
  console.log(`  Variaciones     : ${importadasVariaciones}`);
  console.log(`  Sin clasificar  : ${sinClasificar}`);
  console.log(`  Errores         : ${errores}`);
  console.log("═══════════════════════════════════════════════════");
}

main().catch(err => {
  console.error("[ERROR] Fatal:", err);
  process.exit(1);
});
