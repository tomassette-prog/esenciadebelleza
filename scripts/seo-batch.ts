/**
 * scripts/seo-batch.ts
 *
 * Regenera los campos SEO (seo_title, seo_description, texto_enriquecido_seo)
 * para todos los productos de la base de datos usando lib/seo-generator.ts.
 *
 * Por defecto solo actualiza productos donde texto_enriquecido_seo IS NULL
 * (los que nunca se han enriquecido). Para forzar la actualización de TODOS
 * los productos, pasa el flag --todos.
 *
 * Uso:
 *   npm run seo:batch              ← solo productos sin texto_enriquecido_seo
 *   npm run seo:batch -- --todos   ← regenera todos (sobreescribe)
 *
 * Añade a package.json:
 *   "seo:batch": "ts-node --project tsconfig.scripts.json scripts/seo-batch.ts"
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import { generarSeoProducto } from "../lib/seo-generator";

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BATCH_SIZE = 100;

if (!SUPA_URL || !SUPA_KEY) {
  console.error("[ERROR] Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local");
  process.exit(1);
}

const supabase = createClient(SUPA_URL, SUPA_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const soloVacios = !process.argv.includes("--todos");

  console.log("═══════════════════════════════════════════════════════");
  console.log("  Esencia de Belleza — SEO Batch Generator");
  console.log(`  Modo: ${soloVacios ? "solo productos SIN texto_enriquecido_seo" : "TODOS los productos (sobreescribe)"}`);
  console.log("═══════════════════════════════════════════════════════\n");

  // 1. Cargar todos los productos (con marca)
  console.log("① Cargando productos desde Supabase…");

  interface ProductoRow {
    id: string;
    nombre: string;
    categoria: string;
    subcategoria: string | null;
    descripcion_general: string | null;
    texto_enriquecido_seo: string | null;
    marca: { nombre: string } | null;
  }

  let todos: ProductoRow[] = [];
  let offset = 0;
  while (true) {
    let query = supabase
      .from("productos_padre")
      .select("id, nombre, categoria, subcategoria, descripcion_general, texto_enriquecido_seo, marca:marcas(nombre)")
      .range(offset, offset + 999);

    if (soloVacios) {
      query = query.is("texto_enriquecido_seo", null);
    }

    const { data, error } = await query;
    if (error) {
      console.error("[ERROR] Cargando productos:", error.message);
      process.exit(1);
    }
    if (!data || data.length === 0) break;
    todos = todos.concat(data as unknown as ProductoRow[]);
    if (data.length < 1000) break;
    offset += 1000;
  }

  console.log(`   Productos a procesar: ${todos.length}\n`);

  if (todos.length === 0) {
    console.log("✓ Todos los productos ya tienen SEO enriquecido. Nada que hacer.");
    return;
  }

  // 2. Generar SEO y actualizar en batches
  let actualizados = 0;
  let errores = 0;

  for (let i = 0; i < todos.length; i += BATCH_SIZE) {
    const lote = todos.slice(i, i + BATCH_SIZE);
    const updates: {
      id: string;
      seo_title: string;
      seo_description: string;
      texto_enriquecido_seo: string;
    }[] = [];

    for (const p of lote) {
      const marcaNombre = (p.marca as { nombre: string } | null)?.nombre ?? null;
      const seo = generarSeoProducto({
        nombre: p.nombre,
        marca: marcaNombre,
        categoria: p.categoria,
        subcategoria: p.subcategoria,
        descripcion: p.descripcion_general,
      });

      updates.push({
        id: p.id,
        seo_title: seo.seo_title,
        seo_description: seo.seo_description,
        texto_enriquecido_seo: seo.texto_enriquecido_seo,
      });
    }

    // Update individual por id dentro del lote (Promise.all)
    const results = await Promise.all(
      updates.map((u) =>
        supabase
          .from("productos_padre")
          .update({
            seo_title: u.seo_title,
            seo_description: u.seo_description,
            texto_enriquecido_seo: u.texto_enriquecido_seo,
          })
          .eq("id", u.id)
      )
    );

    const loteErrores = results.filter((r) => r.error).length;
    const loteOk = results.length - loteErrores;

    if (loteErrores > 0) {
      const primerError = results.find((r) => r.error)?.error;
      console.error(`   [ERROR] Lote ${Math.floor(i / BATCH_SIZE) + 1}: ${primerError?.message}`);
      errores += loteErrores;
    }
    actualizados += loteOk;
    const pct = Math.round(((i + lote.length) / todos.length) * 100);
    process.stdout.write(`\r   Progreso: ${actualizados}/${todos.length} (${pct}%)    `);
  }

  console.log("\n");
  console.log("═══════════════════════════════════════════════════════");
  console.log(`  ✓ Actualizados: ${actualizados}`);
  if (errores > 0) console.log(`  ✗ Errores:      ${errores}`);
  console.log("═══════════════════════════════════════════════════════\n");
}

main().catch((err) => {
  console.error("[ERROR FATAL]", err);
  process.exit(1);
});
