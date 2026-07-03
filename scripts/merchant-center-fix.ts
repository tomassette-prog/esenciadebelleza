/**
 * scripts/merchant-center-fix.ts
 *
 * Procesa CSV descargado de Google Merchant Center con productos incompletos.
 * Enriquece automáticamente descripciones con Fórmula, Ingrediente, Beneficios.
 *
 * Uso:
 *   npm run merchant:fix -- --file="./downloads/google-merchant-errors.csv"
 *
 * El script:
 * 1. Lee el CSV de Google Merchant Center
 * 2. Identifica productos sin descripción o incompletos
 * 3. Genera texto enriquecido con IA (Fórmula, Ingrediente, Beneficios)
 * 4. Actualiza la descripción en Supabase
 * 5. Guarda log de cambios
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { parse } from "csv-parse/sync";
import * as fs from "fs";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const CLAUDE_API_KEY = process.env.ANTHROPIC_API_KEY!;

const supabase = createClient(SUPA_URL, SUPA_KEY);
const claude = new Anthropic();

interface ProductoGoogleCSV {
  Producto: string;
  "ID de producto": string;
  Idioma: string;
  "Etiqueta de feed": string;
  Descripción: string;
  "Datos importantes": string;
  "Añadir a la descripción": string;
}

interface ProductoMejorado {
  id: string;
  nombre: string;
  descripcionActual: string;
  queAgregar: string;
  descripcionNueva?: string;
}

async function generarDescripcionEnriquecida(producto: ProductoMejorado): Promise<string> {
  const prompt = `Eres un especialista en copywriting para productos de belleza y peluquería.
  
Producto: ${producto.nombre}
Descripción actual: ${producto.descripcionActual || "Sin descripción"}
Se necesita agregar: ${producto.queAgregar}

Genera una descripción enriquecida que incluya:
- Fórmula: ingredientes principales y cómo actúan
- Ingrediente: detalles del ingrediente estrella si lo hay
- Beneficios: beneficios para el cliente finales

Importante:
- Mantén un tono profesional y atractivo
- Sé conciso pero informativo (máx 500 caracteres)
- Si ya hay descripción, complétala; no la repliques
- Enfoca en lo que el cliente busca (resultados, no solo composición)

Devuelve SOLO el texto enriquecido, sin explicaciones.`;

  try {
    const response = await claude.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 500,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const text = response.content[0];
    if (text.type === "text") {
      return text.text.trim();
    }
    return "";
  } catch (error) {
    console.error(`[ERROR] No se pudo generar descripción para ${producto.nombre}:`, error);
    return "";
  }
}

async function procesarCSV(filePath: string) {
  console.log(`\n📥 Leyendo archivo: ${filePath}`);

  if (!fs.existsSync(filePath)) {
    console.error(`[ERROR] No se encontró el archivo: ${filePath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(filePath, "utf-8");
  const records: ProductoGoogleCSV[] = parse(content, {
    columns: true,
    skip_empty_lines: true,
    encoding: "utf-16le",
  });

  console.log(`✅ Se encontraron ${records.length} productos en el CSV`);

  // Filtrar productos que necesitan actualización
  const productosIncompletos: ProductoMejorado[] = records
    .filter((r) => !r.Descripción || r.Descripción.trim() === "")
    .map((r) => ({
      id: r["ID de producto"],
      nombre: r.Producto,
      descripcionActual: r.Descripción || "",
      queAgregar: r["Añadir a la descripción"],
    }));

  console.log(`\n🔍 Productos incompletos encontrados: ${productosIncompletos.length}`);

  if (productosIncompletos.length === 0) {
    console.log("✅ Todos los productos tienen descripciones.");
    return;
  }

  // Generar descripciones con IA
  console.log("\n⏳ Generando descripciones enriquecidas con IA...");
  const productosMejorados: ProductoMejorado[] = [];

  for (let i = 0; i < productosIncompletos.length; i++) {
    const producto = productosIncompletos[i];
    console.log(`[${i + 1}/${productosIncompletos.length}] ${producto.nombre}`);

    const descripcionNueva = await generarDescripcionEnriquecida(producto);
    productosMejorados.push({
      ...producto,
      descripcionNueva,
    });

    // Rate limiting
    await new Promise((r) => setTimeout(r, 1000));
  }

  // Actualizar en Supabase
  console.log("\n💾 Actualizando productos en Supabase...");
  const logActualizaciones: Array<{ nombre: string; exito: boolean; error?: string }> = [];

  for (const producto of productosMejorados) {
    try {
      // Buscar producto por nombre o woo_id si es disponible
      const { data: productoEnDB, error: errorBusqueda } = await supabase
        .from("productos_padre")
        .select("id, descripcion")
        .or(`nombre.ilike.%${producto.nombre}%,woo_id.eq.${producto.id}`)
        .single();

      if (errorBusqueda || !productoEnDB) {
        logActualizaciones.push({
          nombre: producto.nombre,
          exito: false,
          error: "Producto no encontrado en BD",
        });
        continue;
      }

      // Combinar descripción actual con la nueva
      let descripcionFinal = producto.descripcionNueva;
      if (productoEnDB.descripcion && productoEnDB.descripcion.trim()) {
        descripcionFinal = `${productoEnDB.descripcion}\n\n${producto.descripcionNueva}`;
      }

      const { error: errorUpdate } = await supabase
        .from("productos_padre")
        .update({
          descripcion: descripcionFinal,
          updated_at: new Date().toISOString(),
        })
        .eq("id", productoEnDB.id);

      if (errorUpdate) throw errorUpdate;

      logActualizaciones.push({
        nombre: producto.nombre,
        exito: true,
      });

      console.log(`  ✅ ${producto.nombre}`);
    } catch (error) {
      logActualizaciones.push({
        nombre: producto.nombre,
        exito: false,
        error: String(error),
      });
      console.error(`  ❌ ${producto.nombre}: ${error}`);
    }
  }

  // Resumen y guardar log
  const exitosos = logActualizaciones.filter((l) => l.exito).length;
  const fallidos = logActualizaciones.filter((l) => !l.exito).length;

  console.log(`\n📊 Resultado:`);
  console.log(`  ✅ Actualizados: ${exitosos}`);
  console.log(`  ❌ Fallidos: ${fallidos}`);

  // Guardar log
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);
  const logPath = path.join(process.cwd(), `merchant-center-fix-${timestamp}.log`);
  fs.writeFileSync(
    logPath,
    JSON.stringify(
      {
        fecha: new Date().toISOString(),
        archivo: filePath,
        totalProcesados: productosIncompletos.length,
        exitosos,
        fallidos,
        detalles: logActualizaciones,
      },
      null,
      2
    )
  );

  console.log(`\n📝 Log guardado en: ${logPath}`);
}

// Main
const filePath = process.argv
  .find((arg) => arg.startsWith("--file="))
  ?.replace("--file=", "");

if (!filePath) {
  console.error("[ERROR] Uso: npm run merchant:fix -- --file='./ruta/archivo.csv'");
  process.exit(1);
}

procesarCSV(filePath).catch((err) => {
  console.error("[ERROR]", err);
  process.exit(1);
});
