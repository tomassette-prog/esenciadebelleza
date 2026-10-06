// Promo "Champú de Cebolla Anticaída" — aplica precios de oferta en Supabase.
// Uso:
//   node scripts/_promo_cebolla.mjs          -> dry-run (muestra precios actuales y los propuestos)
//   node scripts/_promo_cebolla.mjs --apply  -> aplica los precios de oferta
// Requiere NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.local o variables de entorno.
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

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
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

// Objetivos: slug exacto de productos_padre (evita falsos positivos por nombre,
// p. ej. el champú BLUMIN 1000ML o el propio PACK), precio de oferta y etiqueta
const OBJETIVOS = [
  { slug: "pack-cebolla-champu-1000ml-mascarilla-300ml-valquer", precio_oferta: 19.9, etiqueta: "Pack Cebolla 1000ml + Mascarilla 300ml" },
  { slug: "cuidados-champu-de-cebolla-1000-ml-valquer", precio_oferta: 13.9, etiqueta: "Champú Cebolla 1000 ml" },
];

const { data: padres, error: e1 } = await sb
  .from("productos_padre")
  .select("id, nombre, slug")
  // Filtro en servidor: sin .in() la query topa en 1000 filas y no llega a estos productos
  .in("slug", OBJETIVOS.map((o) => o.slug));
if (e1) { console.error("Error leyendo productos_padre:", e1.message); process.exit(1); }

// Detectar la columna FK de variaciones en tiempo de ejecución (sin asumir esquema).
const { data: probe, error: e2 } = await sb
  .from("productos_variaciones")
  .select("*")
  .limit(1);
if (e2) { console.error("Error leyendo productos_variaciones:", e2.message); process.exit(1); }
const columnas = probe && probe[0] ? Object.keys(probe[0]) : [];
const fk = columnas.find((c) => /producto.*_id|^producto_id$/i.test(c));
if (!fk) {
  console.error("No se detectó la columna FK producto en productos_variaciones. Columnas:", columnas.join(", "));
  process.exit(1);
}
console.log(`FK detectada en productos_variaciones: ${fk}`);
console.log(`Modo: ${APPLY ? "APPLY (aplica precios)" : "DRY-RUN (solo lectura)"}\n`);

for (const obj of OBJETIVOS) {
  const candidatos = (padres || []).filter((p) => p.slug === obj.slug);

  if (candidatos.length === 0) {
    console.log(`[${obj.etiqueta}] SIN MATCH en productos_padre (slug ${obj.slug}).`);
    continue;
  }

  for (const padre of candidatos) {
    console.log(`[${obj.etiqueta}] producto_padre: ${padre.nombre} (id ${padre.id})`);
    const { data: vars, error: e3 } = await sb
      .from("productos_variaciones")
      .select("id, precio_b2c, precio_b2b, precio_comparar, activa, stock")
      .eq(fk, padre.id);
    if (e3) { console.error("  error variaciones:", e3.message); continue; }
    if (!vars || vars.length === 0) { console.log("  sin variaciones."); continue; }

    for (const v of vars) {
      console.log(`  variacion ${v.id}: precio_b2c ${v.precio_b2c} -> ${obj.precio_oferta} (activa=${v.activa}, stock=${v.stock})`);
      if (APPLY) {
        // precio_comparar = "antes" tachado en ficha/tarjeta; b2b sigue a b2c (multiplicador 1.0)
        const { error: e4 } = await sb
          .from("productos_variaciones")
          .update({
            precio_b2c: obj.precio_oferta,
            precio_b2b: obj.precio_oferta,
            precio_comparar: v.precio_b2c > obj.precio_oferta ? v.precio_b2c : (v.precio_comparar ?? null),
          })
          .eq("id", v.id);
        if (e4) console.error("  ERROR update:", e4.message);
        else console.log("  OK");
      }
    }

    if (APPLY) {
      // Marca la ficha como oferta (badge + sección /ofertas)
      const { error: e5 } = await sb
        .from("productos_padre")
        .update({ oferta: true })
        .eq("id", padre.id);
      if (e5) console.error("  ERROR update oferta:", e5.message);
      else console.log("  OK oferta=true");
    }
  }
}

console.log("\nNota: verificar config_tienda.precio_multiplicador_b2c — si el precio mostrado se calcula por multiplicador,");
console.log("el precio final debe ajustarse también en config_tienda o en precio_base según el flujo del front.");
console.log("Detalle de campaña: promos/pack-cebolla/CAMPANA.md");
