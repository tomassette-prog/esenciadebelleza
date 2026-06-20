import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Faltan variables NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const sqlPath = join(__dirname, "../supabase/migrations/010_carruseles_custom.sql");
const sql = readFileSync(sqlPath, "utf8");

// Dividir en statements y ejecutar uno a uno
const statements = sql
  .split(/;\s*\n/)
  .map((s) => s.trim())
  .filter((s) => s.length > 5 && !s.startsWith("--"));

console.log(`Ejecutando ${statements.length} statements...`);

for (const stmt of statements) {
  const { error } = await supabase.rpc("exec_sql", { query: stmt + ";" }).single();
  if (error && !error.message.includes("already exists") && !error.message.includes("does not exist")) {
    // Intentar via from() para CREATE TABLE
    console.log("⚠ RPC no disponible, intentando método directo...");
    break;
  }
  console.log("✓", stmt.slice(0, 60).replace(/\n/g, " "));
}

// Verificar si la tabla ya existe
const { data, error: checkError } = await supabase.from("carruseles").select("id").limit(1);
if (checkError) {
  console.error("\n❌ La tabla carruseles NO existe:", checkError.message);
  console.log("\n👉 Ejecuta manualmente en Supabase SQL Editor:");
  console.log("   https://supabase.com/dashboard/project/yjanobsfzcwpusynvlun/sql/new");
} else {
  console.log("\n✅ La tabla carruseles existe correctamente. Filas:", data?.length ?? 0);
}
