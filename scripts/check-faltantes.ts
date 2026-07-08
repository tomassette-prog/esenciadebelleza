import { obtenerSubcategoriasDinamicas } from "@/lib/categorias-dinamicas";
import { createClient } from "@supabase/supabase-js";

const supa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: false } }
);

async function main() {
  // Obtener subcategorías dinámicas (de la tabla subcategorias)
  const dinamicas = await obtenerSubcategoriasDinamicas();
  const slugsDinamicos = new Set(dinamicas.filter(s => s.categoria === "peluqueria").map(s => s.slug));

  // Obtener subcategorías de productos_padre (Peluquería)
  const { data: productos } = await supa
    .from("productos_padre")
    .select("subcategoria")
    .eq("categoria", "peluqueria")
    .not("subcategoria", "is", null);

  const slugsProductos = new Set(
    (productos || [])
      .map(p => p.subcategoria)
      .filter(Boolean)
  );

  // Encontrar diferencias
  const faltantes = Array.from(slugsProductos).filter(slug => !slugsDinamicos.has(slug));

  console.log("✅ Subcategorías en tabla 'subcategorias' (Peluquería):");
  Array.from(slugsDinamicos).sort().forEach(slug => {
    console.log(`  - ${slug}`);
  });

  console.log("\n📦 Subcategorías en productos (Peluquería):");
  Array.from(slugsProductos).sort().forEach(slug => {
    console.log(`  - ${slug}`);
  });

  if (faltantes.length > 0) {
    console.log("\n⚠️  FALTANTES (en productos pero NO en subcategorias):");
    faltantes.sort().forEach(slug => {
      console.log(`  - ${slug}`);
    });
  } else {
    console.log("\n✅ TODAS las subcategorías de productos ya existen en la tabla 'subcategorias'");
  }
}

main().catch(console.error);
