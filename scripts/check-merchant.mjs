import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

// Load .env.local
const envContent = readFileSync(".env.local", "utf8");
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx === -1) continue;
  const key = trimmed.slice(0, eqIdx).trim();
  let val = trimmed.slice(eqIdx + 1).trim();
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1);
  }
  process.env[key] = val;
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("❌ Missing env vars. URL:", url ? "OK" : "MISSING", "KEY:", key ? "OK" : "MISSING");
  process.exit(1);
}

const supabase = createClient(url, key);

console.log("🔍 Diagnosticando productos para Merchant Center...\n");

// Check total products and active status
const { count: totalAll } = await supabase
  .from("productos_padre")
  .select("id", { count: "exact", head: true });

const { count: totalActive } = await supabase
  .from("productos_padre")
  .select("id", { count: "exact", head: true })
  .eq("activo", true);

const { count: totalInactive } = await supabase
  .from("productos_padre")
  .select("id", { count: "exact", head: true })
  .eq("activo", false);

console.log(`📦 Total productos: ${totalAll}`);
console.log(`✅ Activos: ${totalActive}`);
console.log(`❌ Inactivos: ${totalInactive}`);

// Sample a few to check schema
const { data: sample } = await supabase
  .from("productos_padre")
  .select("id, nombre, activo")
  .limit(5);

console.log("\n── Muestra ──");
for (const p of sample ?? []) {
  console.log(`  • ${p.nombre} | activo: ${p.activo}`);
}

// Load ALL products (no join, no filter)
let todos = [];
let offset = 0;
while (true) {
  const { data, error } = await supabase
    .from("productos_padre")
    .select("id, nombre, slug, categoria, imagen_principal_url, activo")
    .range(offset, offset + 999);
  if (error) {
    console.error("❌ Error en query:", error);
    break;
  }
  if (!data || data.length === 0) break;
  todos = todos.concat(data);
  console.log(`  Batch ${offset}-${offset + data.length}: ${data.length} filas`);
  if (data.length < 1000) break;
  offset += 1000;
}
console.log(`\n📦 Total productos cargados: ${todos.length}`);

// Debug: check activo field types
const activoValues = new Set(todos.map(p => String(p.activo)));
console.log(`Valores únicos de 'activo': ${[...activoValues].join(", ")}`);

// Filter active in JS
const activos = todos.filter(p => p.activo === true || p.activo === "true" || p.activo === 1);
console.log(`Productos activos (JS filter): ${activos.length}`);

// Load all variations
let variaciones = [];
offset = 0;
while (true) {
  const { data } = await supabase
    .from("productos_variaciones")
    .select("id, producto_padre_id, activa, stock, precio_b2c")
    .range(offset, offset + 999);
  if (!data || data.length === 0) break;
  variaciones = variaciones.concat(data);
  if (data.length < 1000) break;
  offset += 1000;
}
console.log(`📦 Total variaciones cargadas: ${variaciones.length}`);

// Group variations by product
const varsByProduct = {};
for (const v of variaciones) {
  if (!varsByProduct[v.producto_padre_id]) varsByProduct[v.producto_padre_id] = [];
  varsByProduct[v.producto_padre_id].push(v);
}

// 2. Categorize problems
const sinVarsActivas = [];
const sinPrecio = [];
const sinNombre = [];
const sinImagen = [];

for (const p of activos) {
  const vars = varsByProduct[p.id] ?? [];
  const activas = vars.filter(v => v.activa);
  const nombre = p.nombre ?? "";

  if (vars.length === 0 || activas.length === 0) {
    sinVarsActivas.push(p);
  } else if (activas.every(v => !v.precio_b2c || v.precio_b2c <= 0)) {
    sinPrecio.push(p);
  }

  if (!nombre || nombre.toLowerCase() === "unidad" || nombre.length < 3) {
    sinNombre.push(p);
  }
  if (!p.imagen_principal_url) {
    sinImagen.push(p);
  }
}

console.log("\n═══════════════════════════════════════════");
console.log("📊 DIAGNÓSTICO");
console.log("═══════════════════════════════════════════");
console.log(`❌ Sin variaciones activas (→ availability): ${sinVarsActivas.length}`);
console.log(`❌ Variaciones activas sin precio (→ price): ${sinPrecio.length}`);
console.log(`❌ Nombre genérico/vacío: ${sinNombre.length}`);
console.log(`❌ Sin imagen: ${sinImagen.length}`);

// 3. Show samples
console.log("\n── Muestra sin variaciones activas (primeros 10) ──");
for (const p of sinVarsActivas.slice(0, 10)) {
  const vars = varsByProduct[p.id] ?? [];
  console.log(`  • ${p.nombre} | vars: ${vars.length} | activas: ${vars.filter(v=>v.activa).length} | stock: ${vars.map(v=>v.stock).join(",")}`);
}

console.log("\n── Muestra sin precio (primeros 10) ──");
for (const p of sinPrecio.slice(0, 10)) {
  const vars = varsByProduct[p.id] ?? [];
  const activas = vars.filter(v=>v.activa);
  console.log(`  • ${p.nombre} | precio: ${activas.map(v=>v.precio_b2c).join(",")} | stock: ${activas.map(v=>v.stock).join(",")}`);
}

// 4. Check total inactive variations
const inactivas = variaciones.filter(v => !v.activa).length;
console.log(`\n── Total variaciones inactivas en BD: ${inactivas} ──`);

// 5. Products with ALL active variations having stock=0
const sinStock = activos.filter(p => {
  const vars = (varsByProduct[p.id] ?? []).filter(v => v.activa);
  return vars.length > 0 && vars.every(v => v.stock <= 0);
});
console.log(`── Productos con variaciones activas pero stock 0: ${sinStock.length} ──`);
