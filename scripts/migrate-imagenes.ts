/**
 * scripts/migrate-imagenes.ts
 *
 * Migra las imágenes de productos desde depeluqueriaproductos.com
 * a Supabase Storage con nombres SEO-friendly.
 *
 * - Descarga cada imagen de la URL original
 * - La sube al bucket "productos" con nombre: {slug}-{index}.webp
 * - Actualiza imagen_principal_url en productos_padre
 * - Actualiza imagen_url en productos_variaciones
 *
 * Uso:
 *   npm run migrate:imagenes
 *
 * El bucket "productos" debe existir en Supabase Storage (público).
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import * as https from "https";
import * as http from "http";
import { URL } from "url";

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BUCKET   = "productos";
const ORIGEN   = "depeluqueriaproductos.com";
const DELAY_MS = 150; // ms entre peticiones para no saturar el origen

if (!SUPA_URL || !SUPA_KEY) {
  console.error("[ERROR] Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local");
  process.exit(1);
}

const supabase = createClient(SUPA_URL, SUPA_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function descargarImagen(urlStr: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(urlStr);
    const mod = parsed.protocol === "https:" ? https : http;

    mod.get(urlStr, { headers: { "User-Agent": "Mozilla/5.0 EsenciaDeBelleza/1.0" } }, (res) => {
      // Seguir redirecciones
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        descargarImagen(res.headers.location).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} al descargar ${urlStr}`));
        return;
      }
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks)));
      res.on("error", reject);
    }).on("error", reject);
  });
}

function mimeDesdeUrl(urlStr: string): string {
  const ext = urlStr.split("?")[0].split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    jpg: "image/jpeg", jpeg: "image/jpeg",
    png: "image/png", webp: "image/webp",
    gif: "image/gif", svg: "image/svg+xml",
  };
  return map[ext] ?? "image/jpeg";
}

function extDesdeUrl(urlStr: string): string {
  const ext = urlStr.split("?")[0].split(".").pop()?.toLowerCase() ?? "jpg";
  return ["jpg","jpeg","png","webp","gif"].includes(ext) ? ext : "jpg";
}

function esUrlExterna(url: string | null): boolean {
  if (!url) return false;
  return url.includes(ORIGEN);
}

async function subirImagen(buffer: Buffer, storagePath: string, mime: string): Promise<string | null> {
  // Si ya existe, no subir de nuevo (upsert)
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, { contentType: mime, upsert: true });

  if (error) {
    console.error(`    [ERROR storage] ${storagePath}:`, error.message);
    return null;
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
  return data.publicUrl;
}

// ── Asegurar que el bucket existe ─────────────────────────────────────────────

async function asegurarBucket() {
  const { data: buckets } = await supabase.storage.listBuckets();
  const existe = buckets?.some((b) => b.name === BUCKET);
  if (!existe) {
    const { error } = await supabase.storage.createBucket(BUCKET, { public: true });
    if (error) {
      console.error("[ERROR] No se pudo crear el bucket:", error.message);
      process.exit(1);
    }
    console.log(`  ✓ Bucket "${BUCKET}" creado.`);
  }
}

// ── Migrar imágenes padre ─────────────────────────────────────────────────────

async function migrarPadres() {
  console.log("\n▶ Procesando imágenes de productos padre...");

  // Obtener todos los productos con imagen externa (paginado, Supabase límite 1000/página)
  const allData: Array<{ id: string; slug: string; imagen_principal_url: string | null }> = [];
  let offset = 0;
  while (true) {
    const { data: page, error } = await supabase
      .from("productos_padre")
      .select("id, slug, imagen_principal_url")
      .not("imagen_principal_url", "is", null)
      .range(offset, offset + 999);
    if (error || !page || page.length === 0) break;
    allData.push(...page);
    if (page.length < 1000) break;
    offset += 1000;
  }
  const data = allData;
  const error = null;

  const conUrlExterna = data.filter((p) => esUrlExterna(p.imagen_principal_url));
  console.log(`  Total con imagen externa: ${conUrlExterna.length} de ${data.length}`);

  let ok = 0, fail = 0;

  for (const prod of conUrlExterna) {
    const urlOrigen = prod.imagen_principal_url!;
    const ext = extDesdeUrl(urlOrigen);
    const storagePath = `padres/${prod.slug}.${ext}`;

    try {
      const buffer = await descargarImagen(urlOrigen);
      const mime   = mimeDesdeUrl(urlOrigen);
      const nuevaUrl = await subirImagen(buffer, storagePath, mime);

      if (nuevaUrl) {
        const { error: upErr } = await supabase
          .from("productos_padre")
          .update({ imagen_principal_url: nuevaUrl })
          .eq("id", prod.id);

        if (upErr) {
          console.error(`    [ERROR update] ${prod.slug}:`, upErr.message);
          fail++;
        } else {
          console.log(`    ✓ ${prod.slug}`);
          ok++;
        }
      } else {
        fail++;
      }
    } catch (e: any) {
      console.error(`    [ERROR descarga] ${prod.slug}: ${e.message}`);
      fail++;
    }

    await sleep(DELAY_MS);
  }

  console.log(`  Padre → OK: ${ok} | FAIL: ${fail}`);
}

// ── Migrar imágenes de variaciones ────────────────────────────────────────────

async function migrarVariaciones() {
  console.log("\n▶ Procesando imágenes de variaciones...");

  const { data, error } = await supabase
    .from("productos_variaciones")
    .select("id, producto_padre_id, nombre_variacion, imagen_url, productos_padre(slug)")
    .not("imagen_url", "is", null);

  if (error || !data) {
    console.error("[ERROR] cargando productos");
    return;
  }

  const conUrlExterna = data.filter((p) => esUrlExterna(p.imagen_url));
  console.log(`  Total variaciones con imagen externa: ${conUrlExterna.length} de ${data.length}`);

  let ok = 0, fail = 0;

  for (const vari of conUrlExterna) {
    const urlOrigen = vari.imagen_url!;
    const padreSlug = (vari.productos_padre as any)?.slug ?? `prod-${vari.producto_padre_id}`;
    // Nombre SEO-friendly: slug-padre--nombre-variacion
    const slugVariacion = vari.nombre_variacion
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const ext = extDesdeUrl(urlOrigen);
    const storagePath = `variaciones/${padreSlug}--${slugVariacion}.${ext}`;

    try {
      const buffer = await descargarImagen(urlOrigen);
      const mime   = mimeDesdeUrl(urlOrigen);
      const nuevaUrl = await subirImagen(buffer, storagePath, mime);

      if (nuevaUrl) {
        const { error: upErr } = await supabase
          .from("productos_variaciones")
          .update({ imagen_url: nuevaUrl })
          .eq("id", vari.id);

        if (upErr) {
          console.error(`    [ERROR update] variacion ${vari.id}:`, upErr.message);
          fail++;
        } else {
          console.log(`    ✓ ${padreSlug} — ${vari.nombre_variacion}`);
          ok++;
        }
      } else {
        fail++;
      }
    } catch (e: any) {
      console.error(`    [ERROR descarga] variacion ${vari.id}: ${e.message}`);
      fail++;
    }

    await sleep(DELAY_MS);
  }

  console.log(`  Variaciones → OK: ${ok} | FAIL: ${fail}`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("═══════════════════════════════════════════════════════");
  console.log("  Esencia de Belleza — Migración de imágenes a Supabase");
  console.log("═══════════════════════════════════════════════════════");

  await asegurarBucket();
  await migrarPadres();
  await migrarVariaciones();

  console.log("\n✅ Migración completada.");
  console.log("   Las imágenes ahora se sirven desde Supabase Storage");
  console.log("   con URLs tipo: https://<proyecto>.supabase.co/storage/v1/object/public/productos/padres/<slug>.jpg");
}

main().catch((e) => {
  console.error("[FATAL]", e);
  process.exit(1);
});
