import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

// Cargar .env.local
const envPath = path.join(process.cwd(), ".env.local");
const envContent = fs.readFileSync(envPath, "utf-8");
const envLines = envContent.split("\n");

let SERVICE_ROLE_KEY = "";
for (const line of envLines) {
  if (line.startsWith("SUPABASE_SERVICE_ROLE_KEY=")) {
    SERVICE_ROLE_KEY = line.replace("SUPABASE_SERVICE_ROLE_KEY=", "").trim().replace(/^["']|["']$/g, "");
    break;
  }
}

if (!SERVICE_ROLE_KEY) {
  console.error("❌ SUPABASE_SERVICE_ROLE_KEY no encontrada en .env.local");
  process.exit(1);
}

// URLs y keys
const SUPABASE_URL = "https://yjanobsfzcwpusynvlun.supabase.co";

const supa = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  // Crear "sprays"
  const { data, error } = await supa
    .from("subcategorias")
    .insert([
      {
        categoria: "peluqueria",
        slug: "sprays",
        label: "Sprays",
        columna: "Styling",
        orden: 13,
        activa: true,
        seo_title: "Sprays para el cabello",
        seo_description: "Compra sprays para el cabello online",
      },
    ])
    .select();

  if (error) {
    console.error("❌ Error al crear:", error.message);
    process.exit(1);
  }

  console.log("✅ Subcategoría 'sprays' creada:");
  console.log(JSON.stringify(data, null, 2));
}

main().catch(console.error);
