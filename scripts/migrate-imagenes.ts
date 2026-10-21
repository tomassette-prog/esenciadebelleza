/**
 * scripts/migrate-imagenes.ts
 *
 * Copia las imágenes de productos desde depeluqueriaproductos.com
 * a Supabase Storage (espejo local) con nombres SEO-friendly.
 *
 * - Descarga cada imagen de la URL de origen
 * - La sube al bucket "productos": padres/{slug}.{ext} y
 *   variaciones/{slug-padre}--{variacion}.{ext}
 * - Guarda la copia en imagen_local_url y la URL copiada en
 *   imagen_origen_url (productos_padre y productos_variaciones)
 *
 * NO modifica imagen_principal_url / imagen_url: la importación
 * diaria sigue escribiendo ahí los datos del proveedor y la web
 * muestra imagen_local_url cuando existe.
 *
 * Es incremental: solo copia productos sin copia o con la imagen de
 * origen cambiada, así que se puede ejecutar tras cada importación.
 *
 * Uso:
 *   npm run migrate:imagenes
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import {
  asegurarBucket,
  copiarImagen,
  necesitaCopia,
  rutaImagenPadre,
  rutaImagenVariacion,
  sleep,
} from "../lib/imagenes-locales";

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const DELAY_MS = 150; // ms entre peticiones para no saturar el origen

if (!SUPA_URL || !SUPA_KEY) {
  console.error("[ERROR] Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local");
  process.exit(1);
}

const supabase = createClient(SUPA_URL, SUPA_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── Imágenes de productos padre ───────────────────────────────────────────────

async function copiarPadres() {
  console.log("\n▶ Procesando imágenes de productos padre...");

  const allData: Array<{
    id: string; slug: string;
    imagen_principal_url: string | null;
    imagen_local_url: string | null;
    imagen_origen_url: string | null;
  }> = [];
  let offset = 0;
  while (true) {
    const { data: page, error } = await supabase
      .from("productos_padre")
      .select("id, slug, imagen_principal_url, imagen_local_url, imagen_origen_url")
      .not("imagen_principal_url", "is", null)
      .range(offset, offset + 999);
    if (error || !page || page.length === 0) break;
    allData.push(...page);
    if (page.length < 1000) break;
    offset += 1000;
  }

  const pendientes = allData.filter((p) =>
    necesitaCopia({
      imagen_local_url: p.imagen_local_url,
      imagen_origen_url: p.imagen_origen_url,
      origenActual: p.imagen_principal_url,
    })
  );
  console.log(`  A copiar: ${pendientes.length} de ${allData.length}`);

  let ok = 0, fail = 0;
  for (const prod of pendientes) {
    const urlOrigen = prod.imagen_principal_url!;
    const estado = await copiarImagen(
      supabase, "productos_padre",
      { id: prod.id, origenActual: urlOrigen },
      rutaImagenPadre(prod.slug, urlOrigen)
    );
    if (estado === "copiada") {
      console.log(`    ✓ ${prod.slug}`);
      ok++;
    } else {
      fail++;
    }
    await sleep(DELAY_MS);
  }

  console.log(`  Padre → OK: ${ok} | FAIL: ${fail} | ya al día: ${allData.length - pendientes.length}`);
}

// ── Imágenes de variaciones ───────────────────────────────────────────────────

async function copiarVariaciones() {
  console.log("\n▶ Procesando imágenes de variaciones...");

  const allData: Array<{
    id: string; nombre_variacion: string | null;
    imagen_url: string | null; imagen_local_url: string | null; imagen_origen_url: string | null;
    productos_padre: { slug: string } | { slug: string }[] | null;
  }> = [];
  let offset = 0;
  while (true) {
    const { data: page, error } = await supabase
      .from("productos_variaciones")
      .select("id, nombre_variacion, imagen_url, imagen_local_url, imagen_origen_url, productos_padre(slug)")
      .not("imagen_url", "is", null)
      .range(offset, offset + 999);
    if (error || !page || page.length === 0) break;
    allData.push(...(page as typeof allData));
    if (page.length < 1000) break;
    offset += 1000;
  }

  const pendientes = allData.filter((v) =>
    necesitaCopia({
      imagen_local_url: v.imagen_local_url,
      imagen_origen_url: v.imagen_origen_url,
      origenActual: v.imagen_url,
    })
  );
  console.log(`  A copiar: ${pendientes.length} de ${allData.length}`);

  let ok = 0, fail = 0;
  for (const vari of pendientes) {
    const urlOrigen = vari.imagen_url!;
    const padre = Array.isArray(vari.productos_padre) ? vari.productos_padre[0] : vari.productos_padre;
    const slugPadre = padre?.slug ?? `prod-${vari.id}`;
    const estado = await copiarImagen(
      supabase, "productos_variaciones",
      { id: vari.id, origenActual: urlOrigen },
      rutaImagenVariacion(slugPadre, vari.nombre_variacion ?? "", urlOrigen)
    );
    if (estado === "copiada") {
      console.log(`    ✓ ${slugPadre} — ${vari.nombre_variacion}`);
      ok++;
    } else {
      fail++;
    }
    await sleep(DELAY_MS);
  }

  console.log(`  Variaciones → OK: ${ok} | FAIL: ${fail} | ya al día: ${allData.length - pendientes.length}`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("═══════════════════════════════════════════════════════");
  console.log("  Esencia de Belleza — Espejo de imágenes a Supabase");
  console.log("═══════════════════════════════════════════════════════");

  await asegurarBucket(supabase);
  await copiarPadres();
  await copiarVariaciones();

  console.log("\n✅ Copia completada.");
  console.log("   La web sirve imagen_local_url cuando existe y usa la URL del");
  console.log("   proveedor como fallback. La importación diaria no se ve afectada.");
}

main().catch((e) => {
  console.error("[FATAL]", e);
  process.exit(1);
});
