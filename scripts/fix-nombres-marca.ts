/**
 * fix-nombres-marca.ts
 *
 * Detecta productos donde el nombre de la marca NO está al inicio del nombre
 * y lo reubica al principio.
 *
 * Casos:
 *   A) Marca al final/medio  → mueve al principio (auto-fix)
 *   B) Marca no aparece      → reporta para revisión manual
 *
 * Uso:
 *   npx tsx scripts/fix-nombres-marca.ts          → dry-run (solo muestra cambios)
 *   npx tsx scripts/fix-nombres-marca.ts --apply  → aplica los cambios en BD
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const APPLY = process.argv.includes("--apply");
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

function normalizarMarca(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

/** Elimina la marca del string (case-insensitive) y limpia espacios/puntuación sobrante */
function quitarMarca(nombre: string, marca: string): string {
  // Buscar la marca ignorando acentos y mayúsculas
  const normNombre = nombre.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const normMarca  = marca.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const idx = normNombre.toLowerCase().indexOf(normMarca.toLowerCase());
  if (idx === -1) return nombre;

  // Reconstruir usando índices del string original
  const antes  = nombre.slice(0, idx).replace(/[\s,\-–—]+$/, "").trim();
  const despues = nombre.slice(idx + marca.length).replace(/^[\s,\-–—]+/, "").trim();

  return [antes, despues].filter(Boolean).join(" ").trim();
}

async function main() {
  console.log(`\n🔍 Analizando nombres de productos...${APPLY ? " [MODO APPLY]" : " [DRY-RUN]"}\n`);

  // Cargar todos los productos con marca asignada
  const { data: productos, error } = await sb
    .from("productos_padre")
    .select("id, nombre, marca:marcas(nombre)")
    .not("marca_id", "is", null)
    .order("nombre");

  if (error || !productos) { console.error("Error:", error?.message); process.exit(1); }

  type Producto = { id: string; nombre: string; marca: { nombre: string } | { nombre: string }[] | null };

  const aCorregir: { id: string; nombreActual: string; nombreNuevo: string }[] = [];
  const sinMarcaEnTexto: { id: string; nombre: string; marca: string }[] = [];
  let yaCorrectos = 0;

  for (const p of productos as Producto[]) {
    const marcaNombre = Array.isArray(p.marca) ? p.marca[0]?.nombre : p.marca?.nombre;
    if (!marcaNombre) continue;

    const normNombre = normalizarMarca(p.nombre);
    const normMarca  = normalizarMarca(marcaNombre);

    // ¿Ya empieza con la marca?
    if (normNombre.startsWith(normMarca)) { yaCorrectos++; continue; }

    // ¿Aparece la marca en algún lugar del nombre?
    if (normNombre.includes(normMarca)) {
      const sinMarca   = quitarMarca(p.nombre, marcaNombre);
      const nombreNuevo = `${marcaNombre} ${sinMarca}`.replace(/\s+/g, " ").trim();
      aCorregir.push({ id: p.id, nombreActual: p.nombre, nombreNuevo });
    } else {
      sinMarcaEnTexto.push({ id: p.id, nombre: p.nombre, marca: marcaNombre });
    }
  }

  // ── Mostrar resultados ──────────────────────────────────────────────────────
  console.log(`✅ Ya correctos (marca al inicio):  ${yaCorrectos}`);
  console.log(`🔧 Autocorregibles (marca desplazada): ${aCorregir.length}`);
  console.log(`⚠️  Revisión manual (marca no en texto): ${sinMarcaEnTexto.length}\n`);

  if (aCorregir.length > 0) {
    console.log("─── AUTOCORRECCIONES ───────────────────────────────────────────");
    aCorregir.slice(0, 50).forEach(({ nombreActual, nombreNuevo }) => {
      console.log(`  ANTES: ${nombreActual}`);
      console.log(`  AHORA: ${nombreNuevo}\n`);
    });
    if (aCorregir.length > 50) console.log(`  ... y ${aCorregir.length - 50} más\n`);
  }

  if (sinMarcaEnTexto.length > 0) {
    console.log("─── REVISIÓN MANUAL (marca no aparece en el nombre) ────────────");
    sinMarcaEnTexto.slice(0, 30).forEach(({ nombre, marca }) => {
      console.log(`  [${marca}]  ${nombre}`);
    });
    if (sinMarcaEnTexto.length > 30) console.log(`  ... y ${sinMarcaEnTexto.length - 30} más`);
    console.log();
  }

  // ── Aplicar cambios si --apply ──────────────────────────────────────────────
  if (!APPLY) {
    console.log("ℹ️  Ejecuta con --apply para aplicar los cambios.");
    return;
  }

  if (aCorregir.length === 0) { console.log("Nada que corregir."); return; }

  console.log(`\nAplicando ${aCorregir.length} correcciones...`);
  let ok = 0, err = 0;

  // Actualizar en lotes de 50
  for (let i = 0; i < aCorregir.length; i += 50) {
    const lote = aCorregir.slice(i, i + 50);
    await Promise.all(
      lote.map(async ({ id, nombreNuevo }) => {
        const { error: upErr } = await sb
          .from("productos_padre")
          .update({ nombre: nombreNuevo })
          .eq("id", id);
        if (upErr) { err++; console.error(`  ERROR ${id}: ${upErr.message}`); }
        else ok++;
      })
    );
    process.stdout.write(`\r  ${ok + err}/${aCorregir.length} procesados...`);
  }

  console.log(`\n\n✅ Corregidos: ${ok}  ❌ Errores: ${err}`);
}

main();
