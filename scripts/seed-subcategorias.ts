/**
 * Script para re-insertar las 44 subcategorías en la BD
 * Usa ON CONFLICT DO NOTHING — seguro de re-ejecutar
 * Uso: npx ts-node --project tsconfig.scripts.json scripts/seed-subcategorias.ts
 */

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supa = createClient(url, key, { auth: { persistSession: false } });

const subcategorias = [
  // PELUQUERÍA - Coloración
  { categoria: "peluqueria", slug: "tintes", label: "Tintes", columna: "Coloración", orden: 1 },
  { categoria: "peluqueria", slug: "decoloracion", label: "Decoloración", columna: "Coloración", orden: 2 },
  { categoria: "peluqueria", slug: "oxigenadas", label: "Oxigenadas", columna: "Coloración", orden: 3 },
  { categoria: "peluqueria", slug: "sin-amoniaco", label: "Sin amoniaco", columna: "Coloración", orden: 4 },
  // PELUQUERÍA - Cuidado Capilar
  { categoria: "peluqueria", slug: "champus", label: "Champús", columna: "Cuidado Capilar", orden: 5 },
  { categoria: "peluqueria", slug: "mascarillas", label: "Mascarillas", columna: "Cuidado Capilar", orden: 6 },
  { categoria: "peluqueria", slug: "acondicionadores", label: "Acondicionadores", columna: "Cuidado Capilar", orden: 7 },
  { categoria: "peluqueria", slug: "ampollas-y-serums", label: "Ampollas y Sérums", columna: "Cuidado Capilar", orden: 8 },
  { categoria: "peluqueria", slug: "tratamientos", label: "Tratamientos", columna: "Cuidado Capilar", orden: 9 },
  // PELUQUERÍA - Styling
  { categoria: "peluqueria", slug: "lacas", label: "Lacas", columna: "Styling", orden: 10 },
  { categoria: "peluqueria", slug: "espumas", label: "Espumas", columna: "Styling", orden: 11 },
  { categoria: "peluqueria", slug: "gominas-y-ceras", label: "Gominas y Ceras", columna: "Styling", orden: 12 },
  { categoria: "peluqueria", slug: "rizos", label: "Rizos y Anticrespo", columna: "Styling", orden: 13 },
  { categoria: "peluqueria", slug: "permanentes", label: "Permanentes", columna: "Styling", orden: 14 },
  // PELUQUERÍA - Equipos y Herramientas
  { categoria: "peluqueria", slug: "secadores-y-planchas", label: "Secadores y Planchas", columna: "Equipos y Herramientas", orden: 15 },
  { categoria: "peluqueria", slug: "maquinas-corte", label: "Máquinas de corte", columna: "Equipos y Herramientas", orden: 16 },
  { categoria: "peluqueria", slug: "cepillos-y-peines", label: "Cepillos y Peines", columna: "Equipos y Herramientas", orden: 17 },
  { categoria: "peluqueria", slug: "tijeras", label: "Tijeras y Navajas", columna: "Equipos y Herramientas", orden: 18 },
  { categoria: "peluqueria", slug: "batas-y-capas", label: "Batas y Capas", columna: "Equipos y Herramientas", orden: 19 },
  { categoria: "peluqueria", slug: "utensilios", label: "Utensilios y Accesorios", columna: "Equipos y Herramientas", orden: 20 },
  { categoria: "peluqueria", slug: "mobiliario", label: "Mobiliario", columna: "Equipos y Herramientas", orden: 21 },
  // ESTÉTICA - Facial
  { categoria: "estetica", slug: "cremas-faciales", label: "Cremas faciales", columna: "Facial", orden: 22 },
  { categoria: "estetica", slug: "mascarillas-faciales", label: "Mascarillas faciales", columna: "Facial", orden: 23 },
  { categoria: "estetica", slug: "serums-faciales", label: "Sérums y Contorno de ojos", columna: "Facial", orden: 24 },
  { categoria: "estetica", slug: "gel-facial", label: "Gel facial y limpieza", columna: "Facial", orden: 25 },
  // ESTÉTICA - Corporal
  { categoria: "estetica", slug: "cremas-corporales", label: "Cremas corporales", columna: "Corporal", orden: 26 },
  { categoria: "estetica", slug: "aceites-corporales", label: "Aceites corporales", columna: "Corporal", orden: 27 },
  { categoria: "estetica", slug: "leche-corporal", label: "Leche corporal", columna: "Corporal", orden: 28 },
  { categoria: "estetica", slug: "gel-corporal", label: "Gel de ducha", columna: "Corporal", orden: 29 },
  { categoria: "estetica", slug: "peeling", label: "Peeling y Exfoliantes", columna: "Corporal", orden: 30 },
  // ESTÉTICA - Depilación
  { categoria: "estetica", slug: "ceras-depiladoras", label: "Ceras depiladoras", columna: "Depilación", orden: 31 },
  { categoria: "estetica", slug: "depilatorios", label: "Depilatorios", columna: "Depilación", orden: 32 },
  // ESTÉTICA - Uñas y Maquillaje
  { categoria: "estetica", slug: "manicura-pedicura", label: "Manicura y Pedicura", columna: "Uñas y Maquillaje", orden: 33 },
  { categoria: "estetica", slug: "unas", label: "Limas y Fresas", columna: "Uñas y Maquillaje", orden: 34 },
  { categoria: "estetica", slug: "lamparas-uv", label: "Lámparas UV/LED", columna: "Uñas y Maquillaje", orden: 35 },
  { categoria: "estetica", slug: "maquillaje", label: "Maquillaje", columna: "Uñas y Maquillaje", orden: 36 },
  // BARBERÍA
  { categoria: "barberia", slug: "ceras-barbero", label: "Ceras de barbero", columna: "Afeitado y Barba", orden: 37 },
  { categoria: "barberia", slug: "champus-barba", label: "Champús de barba", columna: "Afeitado y Barba", orden: 38 },
  { categoria: "barberia", slug: "cuidado-caballero", label: "Cuidado caballero", columna: "Styling y cuidado caballero", orden: 39 },
  // PERFUMERÍA
  { categoria: "perfumeria", slug: "eau-de-parfum", label: "Eau de Parfum", columna: "Perfumes", orden: 40 },
  { categoria: "perfumeria", slug: "eau-de-toilette", label: "Eau de Toilette", columna: "Perfumes", orden: 41 },
  { categoria: "perfumeria", slug: "colonias", label: "Colonias", columna: "Perfumes", orden: 42 },
  { categoria: "perfumeria", slug: "ambientadores", label: "Ambientadores", columna: "Ambientación", orden: 43 },
  { categoria: "perfumeria", slug: "brumas-y-velas", label: "Brumas y Velas", columna: "Ambientación", orden: 44 },
];

async function main() {
  console.log(`Insertando ${subcategorias.length} subcategorías...`);

  const { data, error } = await supa
    .from("subcategorias")
    .upsert(subcategorias, { onConflict: "categoria,slug", ignoreDuplicates: false })
    .select("id");

  if (error) {
    console.error("Error al insertar:", error.message);
    process.exit(1);
  }

  console.log(`✅ Insertadas/actualizadas: ${data?.length ?? 0} subcategorías`);

  // Verificar total
  const { count } = await supa.from("subcategorias").select("*", { count: "exact", head: true });
  console.log(`Total en BD: ${count}`);
}

main().catch(console.error);
