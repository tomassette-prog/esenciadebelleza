// Script para limpiar ofertas inconsistentes
// Productos con oferta=true pero sin precio_comparar en ninguna variación

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

// Load env
const envContent = readFileSync(".env.production.local", "utf8");
const env = {};
envContent.split("\n").forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim();
});

const supa = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function main() {
  console.log("Buscando productos con oferta=true...");
  
  const { data: productos, error } = await supa
    .from("productos_padre")
    .select(`
      id, slug, nombre, oferta,
      variaciones:productos_variaciones(precio_comparar, activa)
    `)
    .eq("oferta", true)
    .eq("activo", true);

  if (error) {
    console.error("Error:", error);
    return;
  }

  console.log(`Encontrados ${productos?.length ?? 0} productos con oferta=true`);

  let limpiados = 0;
  let correctos = 0;

  for (const p of (productos || [])) {
    const vars = (p.variaciones || []).filter(v => v.activa);
    const tieneComparar = vars.some(v => v.precio_comparar != null && v.precio_comparar > 0);
    
    if (!tieneComparar) {
      const { error: updateError } = await supa
        .from("productos_padre")
        .update({ oferta: false })
        .eq("id", p.id);
      
      if (updateError) {
        console.error(`Error actualizando ${p.nombre}:`, updateError);
      } else {
        console.log(`🧹 ${p.nombre} — oferta removida (sin precio_comparar)`);
        limpiados++;
      }
    } else {
      correctos++;
    }
  }

  console.log(`\n✅ Resumen:`);
  console.log(`   - ${correctos} productos con oferta válida (tienen precio_comparar)`);
  console.log(`   - ${limpiados} productos limpiados (oferta removida)`);
}

main().catch(console.error);
