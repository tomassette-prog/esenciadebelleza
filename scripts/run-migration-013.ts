import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { join } from "path";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Faltan variables NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url!, key!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  // Verificar si las tablas ya existen
  const { error: checkErr } = await supabase
    .from("packs_regalo")
    .select("id")
    .limit(1);

  if (!checkErr) {
    console.log("✓ Tabla packs_regalo YA EXISTE. Nada que hacer.");
    return;
  }

  // No existe → mostrar instrucciones para ejecutar manualmente
  const sqlPath = join(process.cwd(), "supabase", "migrations", "013_packs_regalo.sql");
  const sql = readFileSync(sqlPath, "utf8");

  console.log("✗ Tabla packs_regalo no existe. Ejecuta el siguiente SQL en el dashboard de Supabase:");
  console.log("  https://supabase.com/dashboard/project/yjanobsfzcwpusynvlun/sql/new");
  console.log("\n--- SQL a ejecutar ---\n");
  console.log(sql);
  console.log("\n--- FIN SQL ---\n");
}

main().catch((e) => { console.error(e); process.exit(1); });
