// Limpiar ofertas inconsistentes via Supabase REST API
const SUPABASE_URL = "https://yjanobsfzcwpusynvlun.supabase.co";

// Read service role key from Vercel
import { execSync } from "child_process";

let serviceKey = "";
try {
  // Try to get from env
  serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
} catch {}

if (!serviceKey) {
  // Try to read from .env.production.local
  try {
    const fs = await import("fs");
    const content = fs.readFileSync(".env.production.local", "utf8");
    const match = content.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/);
    if (match) serviceKey = match[1].trim().replace(/^["']|["']$/g, "");
  } catch {}
}

if (!serviceKey) {
  console.error("No se encontró SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

console.log("Key found, length:", serviceKey.length);

// First, count products with oferta=true
const countRes = await fetch(`${SUPABASE_URL}/rest/v1/productos_padre?oferta=eq.true&activo=eq.true&select=id`, {
  headers: {
    "apikey": serviceKey,
    "Authorization": `Bearer ${serviceKey}`,
    "Prefer": "count=exact"
  }
});

const count = countRes.headers.get("content-range")?.split("/")[1] || "?";
console.log(`Productos con oferta=true: ${count}`);

// Find products with oferta=true but no precio_comparar
const productsRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/productos_oferta_sin_comparar`, {
  method: "POST",
  headers: {
    "apikey": serviceKey,
    "Authorization": `Bearer ${serviceKey}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({})
});

if (productsRes.ok) {
  const products = await productsRes.json();
  console.log(`Productos oferta sin precio_comparar: ${products.length}`);
} else {
  // Function doesn't exist, use manual approach
  console.log("Función no existe, usando consulta manual...");
  
  // Get all products with oferta=true
  const allRes = await fetch(`${SUPABASE_URL}/rest/v1/productos_padre?oferta=eq.true&activo=eq.true&select=id,slug,nombre,variaciones:productos_variaciones(precio_comparar,activa)`, {
    headers: {
      "apikey": serviceKey,
      "Authorization": `Bearer ${serviceKey}`,
    }
  });
  
  const products = await allRes.json();
  console.log(`Total productos oferta: ${products.length}`);
  
  let limpiados = 0;
  for (const p of products) {
    const vars = (p.variaciones || []).filter(v => v.activa);
    const tieneComparar = vars.some(v => v.precio_comparar != null && v.precio_comparar > 0);
    
    if (!tieneComparar) {
      // Update oferta to false
      const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/productos_padre?id=eq.${p.id}`, {
        method: "PATCH",
        headers: {
          "apikey": serviceKey,
          "Authorization": `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
          "Prefer": "return=minimal"
        },
        body: JSON.stringify({ oferta: false })
      });
      
      if (updateRes.ok) {
        console.log(`🧹 ${p.nombre} — oferta removida`);
        limpiados++;
      } else {
        console.error(`Error actualizando ${p.nombre}:`, await updateRes.text());
      }
    }
  }
  
  console.log(`\n✅ ${limpiados} productos limpiados`);
}
