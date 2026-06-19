/**
 * scripts/upload-logos.ts
 *
 * Lee los logos descargados por el script Python desde la carpeta local,
 * los sube al bucket "logos" de Supabase Storage y actualiza el campo
 * logo_url de la tabla marcas.
 *
 * Prerequisito: haber ejecutado el script Python que descarga los logos en
 *   ~/Escritorio/imagenes/logos peluqueria/
 *   o
 *   ~/Desktop/imagenes/logos peluqueria/
 *
 * Uso:
 *   npm run upload:logos
 *
 * El bucket "logos" debe estar creado en Supabase → Storage (puede ser público).
 * Si no existe, el script lo crea automáticamente.
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { createClient } from "@supabase/supabase-js";

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BUCKET   = "logos";

if (!SUPA_URL || !SUPA_KEY) {
  console.error("[ERROR] Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local");
  process.exit(1);
}

const supabase = createClient(SUPA_URL, SUPA_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── Buscar la carpeta de logos ────────────────────────────────────────────────
function encontrarCarpetaLogos(): string | null {
  const home = os.homedir();
  const candidatos = [
    path.join(home, "Escritorio", "imagenes", "logos peluqueria"),
    path.join(home, "Desktop",    "imagenes", "logos peluqueria"),
  ];
  for (const ruta of candidatos) {
    if (fs.existsSync(ruta)) return ruta;
  }
  return null;
}

// ── Mapeo nombre archivo → nombre de marca en Supabase ───────────────────────
// El script Python guarda archivos como "logo_yunsey.png", "logo_wella.jpg"...
// Necesitamos encontrar la marca correspondiente en Supabase por nombre/slug.
function extraerNombreMarca(nombreArchivo: string): string {
  // "logo_yunsey.png" → "yunsey"
  return nombreArchivo
    .replace(/^logo_/, "")
    .replace(/\.[^.]+$/, "")      // quitar extensión
    .replace(/_/g, " ");           // underscores → espacios
}

// ── Detectar MIME type por extensión ─────────────────────────────────────────
function mimeType(ext: string): string {
  const map: Record<string, string> = {
    ".png":  "image/png",
    ".jpg":  "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg":  "image/svg+xml",
    ".webp": "image/webp",
  };
  return map[ext.toLowerCase()] ?? "image/png";
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log("═══════════════════════════════════════════════════════");
  console.log("  Esencia de Belleza — Upload Logos de Marcas");
  console.log("═══════════════════════════════════════════════════════\n");

  // 1. Localizar carpeta
  const carpeta = encontrarCarpetaLogos();
  if (!carpeta) {
    console.error("[ERROR] No se encontró la carpeta de logos.");
    console.error("  Ejecuta primero el script Python para descargar los logos.");
    console.error("  Rutas buscadas:");
    console.error("    ~/Escritorio/imagenes/logos peluqueria/");
    console.error("    ~/Desktop/imagenes/logos peluqueria/");
    process.exit(1);
  }
  console.log(`① Carpeta de logos: ${carpeta}`);

  // 2. Listar archivos de imagen
  const archivos = fs.readdirSync(carpeta).filter((f) => {
    const ext = path.extname(f).toLowerCase();
    return [".png", ".jpg", ".jpeg", ".svg", ".webp"].includes(ext);
  });
  console.log(`   Archivos encontrados: ${archivos.length}\n`);

  if (archivos.length === 0) {
    console.error("[ERROR] No hay imágenes en la carpeta. Ejecuta el script Python primero.");
    process.exit(1);
  }

  // 3. Asegurarse de que el bucket existe
  const { data: buckets } = await supabase.storage.listBuckets();
  const bucketExiste = (buckets ?? []).some((b) => b.name === BUCKET);
  if (!bucketExiste) {
    console.log(`② Creando bucket público "${BUCKET}"...`);
    const { error } = await supabase.storage.createBucket(BUCKET, { public: true });
    if (error) {
      console.error(`[ERROR] No se pudo crear el bucket: ${error.message}`);
      process.exit(1);
    }
    console.log(`   Bucket "${BUCKET}" creado.\n`);
  } else {
    console.log(`② Bucket "${BUCKET}" ya existe.\n`);
  }

  // 4. Cargar todas las marcas de Supabase para hacer el match
  const { data: marcas, error: errMarcas } = await supabase
    .from("marcas")
    .select("id, nombre, slug");
  if (errMarcas || !marcas) {
    console.error("[ERROR] No se pudieron cargar las marcas:", errMarcas?.message);
    process.exit(1);
  }
  console.log(`③ Marcas en Supabase: ${marcas.length}\n`);

  // 5. Procesar cada archivo
  let subidos  = 0;
  let omitidos = 0;
  let errores  = 0;
  const noEncontradas: string[] = [];

  for (const archivo of archivos) {
    const rutaArchivo = path.join(carpeta, archivo);
    const ext         = path.extname(archivo).toLowerCase();
    const mime        = mimeType(ext);
    const nombreMarca = extraerNombreMarca(archivo);

    // Buscar marca en Supabase (por slug o nombre, case-insensitive)
    const marcaMatch = marcas.find((m) =>
      m.slug.toLowerCase() === nombreMarca.toLowerCase() ||
      m.nombre.toLowerCase() === nombreMarca.toLowerCase() ||
      m.slug.toLowerCase().replace(/-/g, " ") === nombreMarca.toLowerCase() ||
      m.nombre.toLowerCase().replace(/\s+/g, "-") === nombreMarca.toLowerCase()
    );

    if (!marcaMatch) {
      noEncontradas.push(`${archivo} → "${nombreMarca}" (no coincide con ninguna marca en BD)`);
      continue;
    }

    // Subir a Supabase Storage
    const storagePath = `marcas/${marcaMatch.slug}${ext}`;
    const fileBuffer  = fs.readFileSync(rutaArchivo);

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, fileBuffer, {
        contentType: mime,
        upsert: true,  // sobreescribir si ya existe
      });

    if (uploadError) {
      console.error(`  [ERROR] ${archivo}: ${uploadError.message}`);
      errores++;
      continue;
    }

    // Obtener URL pública
    const { data: urlData } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(storagePath);
    const logoUrl = urlData.publicUrl;

    // Actualizar marcas.logo_url
    const { error: updateError } = await supabase
      .from("marcas")
      .update({ logo_url: logoUrl })
      .eq("id", marcaMatch.id);

    if (updateError) {
      console.error(`  [ERROR] Actualizando ${marcaMatch.nombre}: ${updateError.message}`);
      errores++;
    } else {
      console.log(`  ✓ ${marcaMatch.nombre} → ${storagePath}`);
      subidos++;
    }
  }

  // 6. Resumen
  console.log("\n═══════════════════════════════════════════════════════");
  console.log(`  ✓ Subidos y actualizados: ${subidos}`);
  if (omitidos > 0) console.log(`  - Omitidos:              ${omitidos}`);
  if (errores > 0)  console.log(`  ✗ Errores:               ${errores}`);
  if (noEncontradas.length > 0) {
    console.log(`\n  ⚠ Sin coincidencia en BD (${noEncontradas.length}):`);
    noEncontradas.forEach((m) => console.log(`    · ${m}`));
    console.log("\n  Tip: ajusta el DICCIONARIO_MARCAS del script Python o");
    console.log("       asegúrate de que el nombre coincide con el slug/nombre en Supabase.");
  }
  console.log("═══════════════════════════════════════════════════════\n");
}

main().catch((err) => {
  console.error("[ERROR FATAL]", err);
  process.exit(1);
});
