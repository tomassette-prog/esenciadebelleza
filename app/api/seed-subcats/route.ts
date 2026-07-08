import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Endpoint temporal para re-insertar subcategorías
// ELIMINAR DESPUÉS DE USAR
export async function POST(req: NextRequest) {
  const auth = req.headers.get("x-seed-token");
  if (auth !== "seed-subcats-2026") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supa = createAdminClient();

  const subcategorias = [
    { categoria: "peluqueria", slug: "tintes", label: "Tintes", columna: "Coloración", orden: 1, activa: true },
    { categoria: "peluqueria", slug: "decoloracion", label: "Decoloración", columna: "Coloración", orden: 2, activa: true },
    { categoria: "peluqueria", slug: "oxigenadas", label: "Oxigenadas", columna: "Coloración", orden: 3, activa: true },
    { categoria: "peluqueria", slug: "sin-amoniaco", label: "Sin amoniaco", columna: "Coloración", orden: 4, activa: true },
    { categoria: "peluqueria", slug: "champus", label: "Champús", columna: "Cuidado Capilar", orden: 5, activa: true },
    { categoria: "peluqueria", slug: "mascarillas", label: "Mascarillas", columna: "Cuidado Capilar", orden: 6, activa: true },
    { categoria: "peluqueria", slug: "acondicionadores", label: "Acondicionadores", columna: "Cuidado Capilar", orden: 7, activa: true },
    { categoria: "peluqueria", slug: "ampollas-y-serums", label: "Ampollas y Sérums", columna: "Cuidado Capilar", orden: 8, activa: true },
    { categoria: "peluqueria", slug: "tratamientos", label: "Tratamientos", columna: "Cuidado Capilar", orden: 9, activa: true },
    { categoria: "peluqueria", slug: "lacas", label: "Lacas", columna: "Styling", orden: 10, activa: true },
    { categoria: "peluqueria", slug: "espumas", label: "Espumas", columna: "Styling", orden: 11, activa: true },
    { categoria: "peluqueria", slug: "gominas-y-ceras", label: "Gominas y Ceras", columna: "Styling", orden: 12, activa: true },
    { categoria: "peluqueria", slug: "rizos", label: "Rizos y Anticrespo", columna: "Styling", orden: 13, activa: true },
    { categoria: "peluqueria", slug: "permanentes", label: "Permanentes", columna: "Styling", orden: 14, activa: true },
    { categoria: "peluqueria", slug: "secadores-y-planchas", label: "Secadores y Planchas", columna: "Equipos y Herramientas", orden: 15, activa: true },
    { categoria: "peluqueria", slug: "maquinas-corte", label: "Máquinas de corte", columna: "Equipos y Herramientas", orden: 16, activa: true },
    { categoria: "peluqueria", slug: "cepillos-y-peines", label: "Cepillos y Peines", columna: "Equipos y Herramientas", orden: 17, activa: true },
    { categoria: "peluqueria", slug: "tijeras", label: "Tijeras y Navajas", columna: "Equipos y Herramientas", orden: 18, activa: true },
    { categoria: "peluqueria", slug: "batas-y-capas", label: "Batas y Capas", columna: "Equipos y Herramientas", orden: 19, activa: true },
    { categoria: "peluqueria", slug: "utensilios", label: "Utensilios y Accesorios", columna: "Equipos y Herramientas", orden: 20, activa: true },
    { categoria: "peluqueria", slug: "mobiliario", label: "Mobiliario", columna: "Equipos y Herramientas", orden: 21, activa: true },
    { categoria: "estetica", slug: "cremas-faciales", label: "Cremas faciales", columna: "Facial", orden: 22, activa: true },
    { categoria: "estetica", slug: "mascarillas-faciales", label: "Mascarillas faciales", columna: "Facial", orden: 23, activa: true },
    { categoria: "estetica", slug: "serums-faciales", label: "Sérums y Contorno de ojos", columna: "Facial", orden: 24, activa: true },
    { categoria: "estetica", slug: "gel-facial", label: "Gel facial y limpieza", columna: "Facial", orden: 25, activa: true },
    { categoria: "estetica", slug: "cremas-corporales", label: "Cremas corporales", columna: "Corporal", orden: 26, activa: true },
    { categoria: "estetica", slug: "aceites-corporales", label: "Aceites corporales", columna: "Corporal", orden: 27, activa: true },
    { categoria: "estetica", slug: "leche-corporal", label: "Leche corporal", columna: "Corporal", orden: 28, activa: true },
    { categoria: "estetica", slug: "gel-corporal", label: "Gel de ducha", columna: "Corporal", orden: 29, activa: true },
    { categoria: "estetica", slug: "peeling", label: "Peeling y Exfoliantes", columna: "Corporal", orden: 30, activa: true },
    { categoria: "estetica", slug: "ceras-depiladoras", label: "Ceras depiladoras", columna: "Depilación", orden: 31, activa: true },
    { categoria: "estetica", slug: "depilatorios", label: "Depilatorios", columna: "Depilación", orden: 32, activa: true },
    { categoria: "estetica", slug: "manicura-pedicura", label: "Manicura y Pedicura", columna: "Uñas y Maquillaje", orden: 33, activa: true },
    { categoria: "estetica", slug: "unas", label: "Limas y Fresas", columna: "Uñas y Maquillaje", orden: 34, activa: true },
    { categoria: "estetica", slug: "lamparas-uv", label: "Lámparas UV/LED", columna: "Uñas y Maquillaje", orden: 35, activa: true },
    { categoria: "estetica", slug: "maquillaje", label: "Maquillaje", columna: "Uñas y Maquillaje", orden: 36, activa: true },
    { categoria: "barberia", slug: "ceras-barbero", label: "Ceras de barbero", columna: "Afeitado y Barba", orden: 37, activa: true },
    { categoria: "barberia", slug: "champus-barba", label: "Champús de barba", columna: "Afeitado y Barba", orden: 38, activa: true },
    { categoria: "barberia", slug: "cuidado-caballero", label: "Cuidado caballero", columna: "Styling y cuidado caballero", orden: 39, activa: true },
    { categoria: "perfumeria", slug: "eau-de-parfum", label: "Eau de Parfum", columna: "Perfumes", orden: 40, activa: true },
    { categoria: "perfumeria", slug: "eau-de-toilette", label: "Eau de Toilette", columna: "Perfumes", orden: 41, activa: true },
    { categoria: "perfumeria", slug: "colonias", label: "Colonias", columna: "Perfumes", orden: 42, activa: true },
    { categoria: "perfumeria", slug: "ambientadores", label: "Ambientadores", columna: "Ambientación", orden: 43, activa: true },
    { categoria: "perfumeria", slug: "brumas-y-velas", label: "Brumas y Velas", columna: "Ambientación", orden: 44, activa: true },
  ];

  const { data, error } = await supa
    .from("subcategorias")
    .upsert(subcategorias, { onConflict: "categoria,slug" })
    .select("id");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { count } = await supa
    .from("subcategorias")
    .select("*", { count: "exact", head: true });

  return NextResponse.json({ upserted: data?.length, total: count });
}
