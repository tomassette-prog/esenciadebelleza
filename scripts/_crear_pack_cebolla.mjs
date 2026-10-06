/**
 * scripts/_crear_pack_cebolla.mjs
 *
 * Crea el "Pack Cebolla Anticaída" (champú 1000 ml + mascarilla 300 ml) en Supabase
 * con precio de lanzamiento 19,90 € (antes 22,00 €) y lo deja destacado.
 *
 * Uso:
 *   node scripts/_crear_pack_cebolla.mjs           # dry-run: solo muestra lo que haría
 *   node scripts/_crear_pack_cebolla.mjs --apply    # crea el pack de verdad
 *
 * Requiere en .env.local (o variables de entorno):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

// Robust .env loader: handles UTF-8 and UTF-16 LE files (Windows editors)
for (const f of [".env.local", ".env"]) {
  if (!fs.existsSync(f)) continue;
  const buf = fs.readFileSync(f);
  const text =
    buf[0] === 0xff && buf[1] === 0xfe
      ? buf.toString("utf16le", 2)
      : buf.toString("utf8").replace(/^\uFEFF/, "");
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}

const APPLY = process.argv.includes("--apply");
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !KEY) {
  console.error("❌ Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(URL, KEY);

// ── Config del pack ────────────────────────────────────────────────────────────
const PACK = {
  slug: "pack-cebolla-anticaida",
  nombre: "Pack Cebolla Anticaída 1L + Mascarilla 300 ml",
  descripcion:
    "Pack anticaída champú de cebolla 1000 ml + mascarilla 300 ml por 19,90 €. " +
    "1 litro por menos de lo que otros cobran por 250 ml. Marca profesional VALQUER.",
  precio_pack: 19.9,
  precio_original: 22.0,
  activo: true,
  destacado: true,
  orden: 1,
  // Slugs exactos de productos_padre (evita falsos positivos por nombre)
  buscar: {
    champu: "cuidados-champu-de-cebolla-1000-ml-valquer",
    mascarilla: "cuidados-mascarilla-capilar-cebolla-300-ml-valquer",
  },
};

const norm = (s) =>
  (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

// ── Localizar variaciones ──────────────────────────────────────────────────────
async function encontrarVariacion(slugPadre) {
  const { data: pad, error } = await supabase
    .from("productos_padre")
    .select("id, nombre")
    .eq("slug", slugPadre)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!pad) return { variacion: null, candidatos: [] };

  const { data: vars, error: e2 } = await supabase
    .from("productos_variaciones")
    .select("id, producto_padre_id, nombre_variacion, activa, stock, precio_b2c")
    .eq("producto_padre_id", pad.id);

  if (e2) throw new Error(e2.message);

  const candidatos = vars ?? [];
  const match =
    candidatos.find((v) => v.activa !== false && (v.stock ?? 0) > 0) ??
    candidatos[0] ??
    null;

  return { variacion: match, candidatos };
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n🧅 Pack Cebolla Anticaída — ${APPLY ? "APPLY (creando)" : "DRY-RUN"}\n`);

  // Idempotente: si el pack ya existe no se crea otro
  const { data: existente } = await supabase
    .from("packs_regalo")
    .select("id")
    .eq("slug", PACK.slug)
    .maybeSingle();
  if (existente) {
    console.log(`El pack ya existe (id=${existente.id}). Nada que hacer.`);
    return;
  }

  const { variacion: champu, candidatos: cChampu } = await encontrarVariacion(PACK.buscar.champu);
  const { variacion: mascarilla, candidatos: cMasc } = await encontrarVariacion(PACK.buscar.mascarilla);

  console.log("Champú 1000 ml encontrado:", champu ? `${champu.id} (${champu.nombre_variacion})` : "NO");
  console.log("Mascarilla 300 ml encontrada:", mascarilla ? `${mascarilla.id} (${mascarilla.nombre_variacion})` : "NO");

  if (!champu || !mascarilla) {
    console.log("\n⚠️  No se encontraron ambas variaciones. Candidatos:");
    [...cChampu, ...cMasc].slice(0, 20).forEach((v) =>
      console.log(`   - ${v.id} :: ${v.nombre_variacion} :: stock ${v.stock}`)
    );
    console.log("\nCopia los IDs correctos y ajústalos en el script.");
    return;
  }

  const items = [
    { variacion_id: champu.id, cantidad: 1 },
    { variacion_id: mascarilla.id, cantidad: 1 },
  ];

  console.log("\nPack a crear:");
  console.log(JSON.stringify({ ...PACK, items }, null, 2));

  if (!APPLY) {
    console.log("\n(dry-run) Ejecuta con --apply para crearlo en Supabase.");
    return;
  }

  // Crear pack (mismo patrón que actions/packs.ts -> crearPack)
  const { data: pack, error } = await supabase
    .from("packs_regalo")
    .insert({
      slug: PACK.slug,
      nombre: PACK.nombre,
      descripcion: PACK.descripcion,
      imagen_url: null,
      precio_pack: PACK.precio_pack,
      precio_original: PACK.precio_original,
      activo: PACK.activo,
      destacado: PACK.destacado,
      orden: PACK.orden,
    })
    .select("id")
    .single();

  if (error || !pack) {
    console.error("❌ Error creando el pack:", error?.message);
    process.exit(1);
  }

  const { error: errItems } = await supabase
    .from("packs_regalo_items")
    .insert(items.map((i) => ({ pack_id: pack.id, ...i })));

  if (errItems) {
    console.error("❌ Error añadiendo items:", errItems.message);
    process.exit(1);
  }

  console.log(`\n✅ Pack creado (id=${pack.id}).`);
  console.log("   Siguiente: publica la ficha y activa la oferta en Merchant Center.");
}

main().catch((e) => {
  console.error("❌", e.message);
  process.exit(1);
});
