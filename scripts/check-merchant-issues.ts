/**
 * scripts/check-merchant-issues.ts
 * 
 * Identifica productos que podrían causar problemas en Google Merchant Center:
 * - Sin nombre o nombre genérico
 * - Sin variaciones activas (availability missing)
 * - Sin precio (price missing)
 * - Sin imagen
 * 
 * Uso: npx ts-node --project tsconfig.scripts.json scripts/check-merchant-issues.ts
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const dotenv = require("dotenv");
const path = require("path");
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

// Fallback: known Supabase URL
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://yjanobsfzcwpusynvlun.supabase.co";
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  console.log("═══════════════════════════════════════════════════════");
  console.log("  Diagnóstico: productos problemáticos para Merchant Center");
  console.log("═══════════════════════════════════════════════════════\n");

  // 1. Productos activos sin variaciones activas → availability missing
  console.log("① Productos SIN variaciones activas (availability missing)…");
  const { data: sinVariaciones } = await supabase
    .from("productos_padre")
    .select(`
      id, nombre, slug, categoria,
      variaciones:productos_variaciones(id, activa, stock, precio_b2c)
    `)
    .eq("activo", true);

  const sinVarActivas = (sinVariaciones ?? []).filter((p: { id: string; nombre: string; variaciones: { activa: boolean }[] }) => {
    const vars = p.variaciones as { activa: boolean }[];
    return !vars || vars.length === 0 || !vars.some((v) => v.activa);
  });

  console.log(`   Encontrados: ${sinVarActivas.length}`);
  for (const p of sinVarActivas.slice(0, 10)) {
    console.log(`   - [${p.id}] ${p.nombre} (${p.categoria})`);
  }
  if (sinVarActivas.length > 10) console.log(`   ... y ${sinVarActivas.length - 10} más`);

  // 2. Productos activos con variaciones activas pero sin precio → price missing
  console.log("\n② Productos con variaciones activas pero SIN precio…");
  const sinPrecio = (sinVariaciones ?? []).filter((p: { id: string; nombre: string; variaciones: { activa: boolean; precio_b2c: number }[] }) => {
    const vars = p.variaciones as { activa: boolean; precio_b2c: number }[];
    return vars && vars.some((v) => v.activa && (!v.precio_b2c || v.precio_b2c <= 0));
  });

  console.log(`   Encontrados: ${sinPrecio.length}`);
  for (const p of sinPrecio.slice(0, 10)) {
    console.log(`   - [${p.id}] ${p.nombre} → precio: ${(p.variaciones as { precio_b2c: number }[])[0]?.precio_b2c}`);
  }

  // 3. Productos activos sin nombre o nombre genérico
  console.log("\n③ Productos con nombre genérico o vacío…");
  const { data: todosNombres } = await supabase
    .from("productos_padre")
    .select("id, nombre, slug")
    .eq("activo", true);

  const nombresGenericos = (todosNombres ?? []).filter((p: { id: string; nombre: string; slug: string }) => {
    const n = (p.nombre ?? "").trim().toLowerCase();
    return !n || n === "unidad" || n === "producto" || n.length < 3;
  });

  console.log(`   Encontrados: ${nombresGenericos.length}`);
  for (const p of nombresGenericos.slice(0, 10)) {
    console.log(`   - [${p.id}] nombre="${p.nombre}" slug="${p.slug}"`);
  }

  // 4. Productos activos sin imagen
  console.log("\n④ Productos SIN imagen principal…");
  const { count: sinImagenCount } = await supabase
    .from("productos_padre")
    .select("*", { count: "exact", head: true })
    .eq("activo", true)
    .is("imagen_principal_url", null);

  console.log(`   Encontrados: ${sinImagenCount ?? 0}`);

  // 5. Resumen
  console.log("\n═══════════════════════════════════════════════════════");
  console.log("  Resumen de problemas potenciales:");
  console.log(`  • Sin variaciones activas: ${sinVarActivas.length} productos`);
  console.log(`  • Sin precio válido:       ${sinPrecio.length} productos`);
  console.log(`  • Nombre genérico:         ${nombresGenericos.length} productos`);
  console.log(`  • Sin imagen:              ${sinImagenCount ?? 0} productos`);
  console.log("═══════════════════════════════════════════════════════");

  // 6. IDs únicos de Google del CSV para comparar
  console.log("\n⑤ Los IDs de Google del CSV no se pueden mapear directamente a Supabase.");
  console.log("   Google asigna sus propios IDs internos al crawlear el sitio.");
  console.log("   Para identificar qué productos son, revisa Google Merchant Center →");
  console.log("   Productos → Diagnóstico → Haz clic en cada producto para ver la URL.");
  console.log("   Con la URL puedes identificar el producto en Supabase.");
}

main().catch(console.error);
