import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Faltan variables de entorno. Verifica .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface ProductoCSV {
  nombre: string;
  descripcion: string;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === "," && !insideQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

function parseCSVManual(content: string): ProductoCSV[] {
  const lines = content.split("\n");
  if (lines.length < 3) return [];

  // Skip metadata lines (Nombre:, Filtros:) and find actual header
  let headerLineIndex = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("Producto") && lines[i].includes("Descripción")) {
      headerLineIndex = i;
      break;
    }
  }

  // Parse header
  const headerLine = lines[headerLineIndex];
  const headers = parseCSVLine(headerLine);

  const productoIndex = headers.findIndex((h) =>
    h.toLowerCase().includes("producto")
  );
  const descripcionIndex = headers.findIndex((h) =>
    h.toLowerCase().includes("descripción")
  );

  if (productoIndex === -1 || descripcionIndex === -1) {
    throw new Error("CSV no contiene columnas 'Producto' o 'Descripción'");
  }

  // Parse data rows (starting after header)
  const results: ProductoCSV[] = [];
  for (let i = headerLineIndex + 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;

    const fields = parseCSVLine(lines[i]);
    const nombre = fields[productoIndex]?.trim() || "";
    const descripcion = fields[descripcionIndex]?.trim() || "";

    if (nombre && descripcion) {
      results.push({ nombre, descripcion });
    }
  }

  return results;
}

async function parseCSV(filePath: string): Promise<ProductoCSV[]> {
  const content = fs.readFileSync(filePath, "utf-8");
  return parseCSVManual(content);
}

function normalizeProductName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s*unidad\s*$/i, "") // Remove "Unidad" at end
    .replace(/\s+/g, " ")
    .replace(/(ml|g|kg|l)$/i, "")
    .trim();
}

async function updateDescriptionsBySlugs(
  csvPath: string,
  slugs: string[]
) {
  console.log(`📖 Leyendo CSV: ${csvPath}\n`);
  const productosCSV = await parseCSV(csvPath);

  console.log(`🔍 Buscando ${slugs.length} productos por slug...\n`);

  let matched = 0;
  let unmatched = 0;
  const unmatchedSlugs: string[] = [];

  for (const slug of slugs) {
    // Buscar por slug exacto
    const { data: bdProductos, error } = await supabase
      .from("productos_padre")
      .select("id, nombre, slug")
      .eq("slug", slug);

    if (error) {
      console.error(`❌ Error buscando slug "${slug}":`, error);
      unmatched++;
      unmatchedSlugs.push(slug);
      continue;
    }

    if (!bdProductos || bdProductos.length === 0) {
      console.log(`❌ No encontrado: ${slug}`);
      unmatched++;
      unmatchedSlugs.push(slug);
      continue;
    }

    const bdProducto = bdProductos[0];
    console.log(`✅ Encontrado: ${bdProducto.nombre} (${slug})`);

    // Buscar descripción en CSV por nombre similar
    const normalizedBdName = normalizeProductName(bdProducto.nombre);
    const csvProducto = productosCSV.find((p) => {
      const normalizedCsvName = normalizeProductName(p.nombre);
      return normalizedCsvName.includes(normalizedBdName) || 
             normalizedBdName.includes(normalizedCsvName) ||
             normalizedCsvName.includes("platinum") && normalizedBdName.includes("platinum") ||
             normalizedCsvName.includes("aromatico") && normalizedBdName.includes("aromatico") ||
             normalizedCsvName.includes("for men") && normalizedBdName.includes("for men") ||
             normalizedCsvName.includes("protector") && normalizedBdName.includes("protector") ||
             normalizedCsvName.includes("ampollas") && normalizedBdName.includes("ampollas") ||
             normalizedCsvName.includes("pina") && normalizedBdName.includes("piña");
    });

    if (!csvProducto) {
      console.log(`   ⚠️  No hay descripción en CSV para este producto`);
      continue;
    }

    // Actualizar descripción
    const { error: updateError } = await supabase
      .from("productos_padre")
      .update({ descripcion_general: csvProducto.descripcion })
      .eq("id", bdProducto.id);

    if (updateError) {
      console.error(
        `   ❌ Error actualizando: ${updateError}`
      );
      unmatched++;
    } else {
      console.log(`   ✨ Descripción actualizada`);
      matched++;
    }
  }

  console.log(`\n📊 Resumen:`);
  console.log(`✅ Actualizados: ${matched}`);
  console.log(`❌ No encontrados: ${unmatched}`);

  if (unmatchedSlugs.length > 0) {
    console.log(`\n📋 Slugs no encontrados:`);
    unmatchedSlugs.forEach((slug) => console.log(`  - ${slug}`));
  }
}

const csvPath = process.argv[2];
const slugsArg = process.argv[3];

if (!csvPath || !slugsArg) {
  console.error("❌ Uso: ts-node update-descriptions-by-slug.ts <ruta-csv> <slugs-json-o-separados-por-coma>");
  console.error("   Ej: ts-node ... file.csv '[\"slug1\",\"slug2\"]'");
  console.error("   O:  ts-node ... file.csv 'slug1,slug2,slug3'");
  process.exit(1);
}

let slugs: string[] = [];
try {
  // Intentar parsear como JSON primero
  slugs = JSON.parse(slugsArg);
} catch {
  // Si falla, asumir que están separados por coma
  slugs = slugsArg.split(",").map((s) => s.trim());
}

updateDescriptionsBySlugs(csvPath, slugs).catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
