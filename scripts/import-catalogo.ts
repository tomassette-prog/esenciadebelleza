/**
 * Script: import-catalogo.ts
 * Uso: npx ts-node scripts/import-catalogo.ts
 *
 * Lee catalogo_esencia.json (salida del scraper) y lo inserta
 * en Supabase mediante el cliente admin (service_role).
 * Opera en batches para no saturar la API.
 */

import * as fs from "fs";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";
import { generarSeoProducto } from "../lib/seo-generator";

// ─── Configuración ────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const BATCH_SIZE = 50;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    " Define NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en el entorno"
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ─── Tipos del JSON del scraper ───────────────────────────────────────────────
interface VariacionScraper {
  nombre: string;
  precio: string | null;
  imagen: string | null;
}

interface ProductoScraper {
  nombre: string;
  marca: string | null;
  descripcion: string | null;
  categoria: string;
  subcategoria: string | null;
  url: string;
  imagen_principal: string | null;
  precio_base: string | null;
  variaciones: VariacionScraper[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateSlug(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 100);
}

function parsePrice(raw: string | null): number {
  if (!raw) return 0;
  const num = parseFloat(raw.replace(/[^\d,.]/g, "").replace(",", "."));
  return isNaN(num) ? 0 : num;
}

function generateSku(marca: string | null, nombre: string, variacion: string, idx: number): string {
  const base = [marca, nombre, variacion]
    .filter(Boolean)
    .join("-")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 40);
  return `${base}-${String(idx).padStart(4, "0")}`;
}

async function upsertMarca(nombre: string): Promise<string | null> {
  if (!nombre) return null;
  const slug = generateSlug(nombre);

  const { data, error } = await supabase
    .from("marcas")
    .upsert({ nombre, slug }, { onConflict: "slug" })
    .select("id")
    .single();

  if (error) {
    console.warn(`    Marca "${nombre}": ${error.message}`);
    return null;
  }
  return data.id;
}

async function insertBatch<T extends object>(tabla: string, items: T[]): Promise<number> {
  if (items.length === 0) return 0;
  const { error, count } = await supabase
    .from(tabla)
    .upsert(items, { ignoreDuplicates: false })
    .select("id");

  if (error) {
    console.error(`   Error en batch ${tabla}: ${error.message}`);
    return 0;
  }
  return count ?? items.length;
}

// ─── Función principal ────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const jsonPath = path.resolve(__dirname, "..", "catalogo_esencia.json");

  if (!fs.existsSync(jsonPath)) {
    console.error(" No se encontró catalogo_esencia.json. Ejecuta primero el scraper.");
    process.exit(1);
  }

  const productos: ProductoScraper[] = JSON.parse(
    fs.readFileSync(jsonPath, "utf-8")
  );

  console.log(`\n ${productos.length} productos a importar`);

  // Caché de marcas para no hacer una consulta por cada producto
  const marcaCache = new Map<string, string>();
  let totalPadres = 0;
  let totalVariaciones = 0;
  let skuCounter = 1;

  // Procesar en batches de BATCH_SIZE
  for (let i = 0; i < productos.length; i += BATCH_SIZE) {
    const lote = productos.slice(i, i + BATCH_SIZE);
    const padresBatch: object[] = [];
    const variacionesPorPadre: Map<string, object[]> = new Map();

    for (const p of lote) {
      // ── Marca ──
      let marcaId: string | null = null;
      if (p.marca) {
        if (marcaCache.has(p.marca)) {
          marcaId = marcaCache.get(p.marca)!;
        } else {
          marcaId = await upsertMarca(p.marca);
          if (marcaId) marcaCache.set(p.marca, marcaId);
        }
      }

      // ── Slug único (si hay colisión, añadir sufijo numérico) ──
      let slug = generateSlug(p.nombre);
      if (!slug) slug = `producto-${skuCounter}`;

      const paddedSlug = slug; // upsert por slug, maneja colisiones

      // ── Producto padre ──
      const seo = generarSeoProducto({
        nombre: p.nombre.trim(),
        marca: p.marca ?? null,
        categoria: p.categoria.trim(),
        subcategoria: p.subcategoria?.trim() ?? null,
        descripcion: p.descripcion ?? null,
      });

      const padre = {
        nombre: p.nombre.trim(),
        slug: paddedSlug,
        marca_id: marcaId,
        descripcion_general: p.descripcion ?? null,
        categoria: p.categoria.trim(),
        subcategoria: p.subcategoria?.trim() ?? null,
        imagen_principal_url: p.imagen_principal ?? null,
        activo: true,
        seo_title: seo.seo_title,
        seo_description: seo.seo_description,
        texto_enriquecido_seo: seo.texto_enriquecido_seo,
      };

      padresBatch.push(padre);

      // ── Variaciones ──
      const variacionesProducto: object[] = [];

      if (p.variaciones.length === 0) {
        // Producto sin variaciones → crear una variación "default"
        variacionesProducto.push({
          slug_padre: paddedSlug,
          sku: generateSku(p.marca, p.nombre, "DEFAULT", skuCounter++),
          nombre_variacion: "Unidad",
          precio_b2c: parsePrice(p.precio_base),
          stock: 0,
          imagen_url: p.imagen_principal ?? null,
          activa: true,
        });
      } else {
        for (const v of p.variaciones) {
          variacionesProducto.push({
            slug_padre: paddedSlug,
            sku: generateSku(p.marca, p.nombre, v.nombre, skuCounter++),
            nombre_variacion: v.nombre.trim(),
            precio_b2c: parsePrice(v.precio),
            stock: 0,
            imagen_url: v.imagen ?? p.imagen_principal ?? null,
            activa: true,
          });
        }
      }

      variacionesPorPadre.set(paddedSlug, variacionesProducto);
    }

    // Insertar padres en batch
    const { data: padresInsertados, error: errorPadres } = await supabase
      .from("productos_padre")
      .upsert(padresBatch, { onConflict: "slug" })
      .select("id, slug");

    if (errorPadres) {
      console.error(`   Error padres lote ${i}: ${errorPadres.message}`);
      continue;
    }

    totalPadres += padresInsertados?.length ?? 0;

    // Insertar variaciones con product_padre_id resuelto
    const variacionesConId: object[] = [];
    for (const padre of padresInsertados ?? []) {
      const vars = variacionesPorPadre.get(padre.slug) ?? [];
      for (const v of vars) {
        variacionesConId.push({
          ...(v as Record<string, unknown>),
          producto_padre_id: padre.id,
          slug_padre: undefined,
        });
      }
    }

    if (variacionesConId.length > 0) {
      const { error: errorVars, count } = await supabase
        .from("productos_variaciones")
        .upsert(variacionesConId, { onConflict: "sku" })
        .select("id");

      if (errorVars) {
        console.error(`   Error variaciones lote ${i}: ${errorVars.message}`);
      } else {
        totalVariaciones += count ?? variacionesConId.length;
      }
    }

    const pct = Math.round(((i + lote.length) / productos.length) * 100);
    console.log(
      `   Lote ${Math.floor(i / BATCH_SIZE) + 1}: ${lote.length} productos — ${pct}%`
    );
  }

  console.log(`\n Importación completada`);
  console.log(`   Productos padre : ${totalPadres}`);
  console.log(`   Variaciones     : ${totalVariaciones}`);
}

main().catch((err) => {
  console.error(" Error fatal:", err);
  process.exit(1);
});
