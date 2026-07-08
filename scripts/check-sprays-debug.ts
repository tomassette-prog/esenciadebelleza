import { obtenerSubcategoriasDinamicas } from "@/lib/categorias-dinamicas";

async function main() {
  const subs = await obtenerSubcategoriasDinamicas();
  const sprays = subs.find(s => s.slug === "sprays");
  
  if (!sprays) {
    console.log("❌ NO EXISTE 'sprays' en subcategorías");
    console.log("\nSubcategorías disponibles en Peluquería:");
    subs
      .filter(s => s.categoria === "peluqueria")
      .forEach(s => {
        console.log(`  - ${s.slug} (${s.label}) activa=${s.activa}`);
      });
  } else {
    console.log("✅ Encontrada 'sprays':");
    console.log(`  - Slug: ${sprays.slug}`);
    console.log(`  - Label: ${sprays.label}`);
    console.log(`  - Activa: ${sprays.activa}`);
    console.log(`  - Categoría: ${sprays.categoria}`);
    console.log(`  - Columna: ${sprays.columna}`);
    console.log(`  - Orden: ${sprays.orden}`);
  }
}

main().catch(console.error);
