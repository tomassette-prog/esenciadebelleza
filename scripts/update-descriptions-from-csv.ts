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
  
  console.log("📋 Headers encontrados:", headers);
  
  const productoIndex = headers.findIndex((h) =>
    h.toLowerCase().includes("producto")
  );
  const descripcionIndex = headers.findIndex((h) =>
    h.toLowerCase().includes("descripción")
  );

  if (productoIndex === -1 || descripcionIndex === -1) {
    console.error("❌ Headers disponibles:", headers);
    throw new Error("CSV no contiene columnas 'Producto' o 'Descripción'");
  }

  console.log(`✅ Producto index: ${productoIndex}, Descripción index: ${descripcionIndex}\n`);

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

async function updateDescriptions(csvPath: string) {
  console.log(`📖 Leyendo CSV: ${csvPath}\n`);
  const productosCSV = await parseCSV(csvPath);

  let matched = 0;
  let unmatched = 0;
  const unmatchedList: string[] = [];

  for (const producto of productosCSV) {
    if (!producto.nombre || !producto.descripcion) {
      console.log(`⚠️  Saltando producto sin nombre o descripción`);
      continue;
    }

    const normalizedCSVName = normalizeProductName(producto.nombre);

    // Buscar en BD con coincidencia aproximada
    const { data: bdProductos, error } = await supabase
      .from("productos_padre")
      .select("id, nombre")
      .ilike("nombre", `%${normalizedCSVName}%`);

    if (error) {
      console.error(`❌ Error buscando "${producto.nombre}":`, error);
      unmatched++;
      unmatchedList.push(producto.nombre);
      continue;
    }

    if (!bdProductos || bdProductos.length === 0) {
      console.log(`❌ No encontrado: ${producto.nombre}`);
      unmatched++;
      unmatchedList.push(producto.nombre);
      continue;
    }

    // Si hay múltiples matches, tomar el más similar
    let bestMatch = bdProductos[0];
    if (bdProductos.length > 1) {
      bestMatch = bdProductos.reduce((best, current) => {
        const bestSimilarity = normalizeProductName(best.nombre).length;
        const currentSimilarity = normalizeProductName(current.nombre).length;
        return Math.abs(currentSimilarity - normalizedCSVName.length) <
          Math.abs(bestSimilarity - normalizedCSVName.length)
          ? current
          : best;
      });
    }

    // Actualizar descripción
    const { error: updateError } = await supabase
      .from("productos_padre")
      .update({ descripcion_general: producto.descripcion })
      .eq("id", bestMatch.id);

    if (updateError) {
      console.error(
        `❌ Error actualizando ${bestMatch.nombre}:`,
        updateError
      );
      unmatched++;
      unmatchedList.push(producto.nombre);
    } else {
      console.log(`✅ Actualizado: ${bestMatch.nombre}`);
      matched++;
    }
  }

  console.log(`\n📊 Resumen:`);
  console.log(`✅ Coincidencias: ${matched}`);
  console.log(`❌ No encontrados: ${unmatched}`);

  if (unmatchedList.length > 0) {
    console.log(`\n📋 Productos no encontrados:`);
    unmatchedList.forEach((name) => console.log(`  - ${name}`));
  }
}

const csvPath = process.argv[2];

if (!csvPath) {
  console.error("❌ Uso: ts-node update-descriptions-from-csv.ts <ruta-csv>");
  process.exit(1);
}

updateDescriptions(csvPath).catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
