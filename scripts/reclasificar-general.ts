/**
 * reclasificar-general.ts
 *
 * Reclasifica productos en subcategorías "%-general" usando reglas de palabras
 * clave extraídas del nombre del producto.
 *
 * Confianza HIGH  → primera palabra clave muy específica y unívoca
 * Confianza MEDIUM → keyword presente pero podría haber ambigüedad
 * Sin match       → se deja para revisión manual
 *
 * Uso:
 *   npx tsx scripts/reclasificar-general.ts            → dry-run
 *   npx tsx scripts/reclasificar-general.ts --apply    → aplica solo los HIGH
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const APPLY = process.argv.includes("--apply");
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// ── Reglas de clasificación ───────────────────────────────────────────────────
// Orden importa: la primera regla que coincida gana.
// "high" = match muy específico, "medium" = razonable pero revisar

type Regla = { keywords: string[]; subcategoria: string; confidence: "high" | "medium" };

const REGLAS: Regla[] = [
  // Coloración
  { keywords: ["oxigenada", " oxidante", "peroxide", " vol "],  subcategoria: "oxigenadas",           confidence: "high" },
  { keywords: ["decoloración", "decoloracion", "decolorante", "decapante", "blondor", "blondie"], subcategoria: "decoloracion", confidence: "high" },
  { keywords: ["sin amoniaco", "sin amoníaco", "sin amoniac"], subcategoria: "sin-amoniaco",         confidence: "high" },
  { keywords: ["tinte", " color ", "coloracion", "coloración", "tinte capilar"], subcategoria: "tintes", confidence: "high" },

  // Cuidado capilar
  { keywords: ["champu", "champú", "shampoo", "shampú"],      subcategoria: "champus",              confidence: "high" },
  { keywords: ["ampolla", "ampollas"],                         subcategoria: "ampollas-y-serums",    confidence: "high" },
  { keywords: ["serum capilar", "sérum capilar", "serum cabello", "serum pelo"], subcategoria: "ampollas-y-serums", confidence: "high" },
  { keywords: ["acondicionador", "conditioner", "suavizante"], subcategoria: "acondicionadores",    confidence: "high" },
  { keywords: ["mascarilla capilar", "mascarilla cabello", "mascarilla pelo", "hair mask", "mascarilla nutritiva", "mascarilla reparadora", "mascarilla hidratante"], subcategoria: "mascarillas", confidence: "high" },
  { keywords: ["tratamiento capilar", "tratamiento cabello", "tratamiento pelo", "tratante capilar"], subcategoria: "tratamientos", confidence: "high" },

  // Styling
  { keywords: ["rizos", "anticrespo", "anti-crespo", "curl"],  subcategoria: "rizos",               confidence: "high" },
  { keywords: ["laca capilar", "laca fijación", "laca fijacion", "laca extra", "laca normal", "laca suave", "laca cabello"], subcategoria: "lacas", confidence: "high" },
  { keywords: ["espuma capilar", "espuma cabello", "espuma rizos", "mousse capilar"], subcategoria: "espumas", confidence: "high" },
  { keywords: ["gomina", "gel fijacion", "gel fijación", "gel capilar", "cera capilar", "cera cabello", "cera pelo"], subcategoria: "gominas-y-ceras", confidence: "high" },
  { keywords: ["permanente", "permanentes"],                   subcategoria: "permanentes",          confidence: "high" },

  // Equipos
  { keywords: ["secador", "hair dryer", "difusor"],            subcategoria: "secadores-y-planchas", confidence: "high" },
  { keywords: ["plancha"],                                     subcategoria: "secadores-y-planchas", confidence: "high" },
  { keywords: ["maquina de corte", "máquina de corte", "cortapelo", "maquinilla", "clipper", "trimmer"], subcategoria: "maquinas-corte", confidence: "high" },
  { keywords: ["cepillo capilar", "cepillo cabello", "cepillo pelo", "peine"],  subcategoria: "cepillos-y-peines", confidence: "high" },

  // Medium — keywords más genéricas
  { keywords: ["laca"],                                        subcategoria: "lacas",               confidence: "medium" },
  { keywords: ["espuma"],                                      subcategoria: "espumas",             confidence: "medium" },
  { keywords: ["serum"],                                       subcategoria: "ampollas-y-serums",   confidence: "medium" },
  { keywords: ["mascarilla"],                                  subcategoria: "mascarillas",         confidence: "medium" },
  { keywords: ["tratamiento"],                                 subcategoria: "tratamientos",        confidence: "medium" },
  { keywords: ["cepillo"],                                     subcategoria: "cepillos-y-peines",   confidence: "medium" },
];

function clasificar(nombre: string): { subcategoria: string; confidence: "high" | "medium" } | null {
  const n = nombre.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  for (const regla of REGLAS) {
    if (regla.keywords.some(k => n.includes(k))) {
      return { subcategoria: regla.subcategoria, confidence: regla.confidence };
    }
  }
  return null;
}

async function main() {
  console.log(`\n🔍 Analizando productos en subcategorías "general"...${APPLY ? " [MODO APPLY]" : " [DRY-RUN]"}\n`);

  // Cargar en páginas de 1000 para no quedarnos con el límite por defecto
  let todos: { id: string; nombre: string; categoria: string; subcategoria: string }[] = [];
  let from = 0;
  while (true) {
    const { data } = await sb
      .from("productos_padre")
      .select("id, nombre, categoria, subcategoria")
      .ilike("subcategoria", "%-general")
      .eq("activo", true)
      .order("nombre")
      .range(from, from + 999);
    if (!data || data.length === 0) break;
    todos = todos.concat(data);
    if (data.length < 1000) break;
    from += 1000;
  }

  console.log(`Total en subcategorías general: ${todos.length}\n`);

  const high:   { id: string; nombre: string; de: string; subcatNueva: string }[] = [];
  const medium: typeof high = [];
  const sinMatch: { nombre: string; de: string }[] = [];

  for (const p of todos) {
    const resultado = clasificar(p.nombre);
    if (!resultado || resultado.subcategoria === p.subcategoria) {
      sinMatch.push({ nombre: p.nombre, de: `${p.categoria}/${p.subcategoria}` });
      continue;
    }
    const item = { id: p.id, nombre: p.nombre, de: `${p.categoria}/${p.subcategoria}`, subcatNueva: resultado.subcategoria };
    if (resultado.confidence === "high") high.push(item);
    else medium.push(item);
  }

  const imprimir = (lista: typeof high, label: string, max = 40) => {
    if (lista.length === 0) return;
    console.log(`─── ${label} (${lista.length}) ───────────────────────────────────`);
    lista.slice(0, max).forEach(({ nombre, subcatNueva }) => {
      console.log(`  → ${subcatNueva.padEnd(28)}  ${nombre.slice(0, 65)}`);
    });
    if (lista.length > max) console.log(`  ... y ${lista.length - max} más`);
    console.log();
  };

  imprimir(high,   "✅ HIGH   — se aplicarán automáticamente");
  imprimir(medium, "🟡 MEDIUM — revisión manual recomendada");

  if (sinMatch.length > 0 && sinMatch.length <= 30) {
    console.log(`─── ❓ SIN MATCH — revisar manualmente (${sinMatch.length}) ─────────────────`);
    sinMatch.forEach(({ nombre, de }) => console.log(`  [${de}]  ${nombre.slice(0, 70)}`));
    console.log();
  }

  console.log(`📊 Resumen:`);
  console.log(`   HIGH (auto):     ${high.length}`);
  console.log(`   MEDIUM (manual): ${medium.length}`);
  console.log(`   Sin match:       ${sinMatch.length}\n`);

  if (!APPLY) {
    console.log("ℹ️  Ejecuta con --apply para mover los HIGH automáticamente.");
    return;
  }

  if (high.length === 0) { console.log("Nada que aplicar automáticamente."); return; }

  console.log(`Aplicando ${high.length} reclasificaciones HIGH...`);
  let ok = 0, err = 0;
  for (let i = 0; i < high.length; i += 50) {
    await Promise.all(
      high.slice(i, i + 50).map(async ({ id, subcatNueva }) => {
        const { error: upErr } = await sb
          .from("productos_padre")
          .update({ subcategoria: subcatNueva })
          .eq("id", id);
        if (upErr) { err++; } else ok++;
      })
    );
    process.stdout.write(`\r  ${ok + err}/${high.length} procesados...`);
  }
  console.log(`\n\n✅ Reclasificados: ${ok}  ❌ Errores: ${err}`);
  console.log(`⚠️  Quedan ${medium.length + sinMatch.length} para revisión manual.`);
}

main();

