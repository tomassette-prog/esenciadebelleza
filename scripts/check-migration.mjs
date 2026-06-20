import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const env = readFileSync(".env.local", "utf8");
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)?.[1]?.trim();
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)?.[1]?.trim();

const sb = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

// Check tabla
const { data: check, error: checkErr } = await sb.from("carruseles").select("id").limit(1);

if (checkErr) {
  console.log("❌ TABLA carruseles NO EXISTE:", checkErr.message);
  console.log("\nEjecutando migración...\n");

  const sql = readFileSync("supabase/migrations/010_carruseles_custom.sql", "utf8");

  // Dividir en statements ejecutables
  const stmts = sql
    .split(/(?<=;)\s*\n/)
    .map(s => s.trim())
    .filter(s => s.length > 5 && !s.startsWith("--"));

  for (const stmt of stmts) {
    const clean = stmt.replace(/--[^\n]*/g, "").trim();
    if (!clean) continue;
    const { error } = await sb.rpc("exec_sql", { sql: clean });
    if (error) {
      console.log("⚠ stmt error:", error.message, "| stmt:", clean.slice(0, 80));
    } else {
      console.log("✓", clean.slice(0, 80).replace(/\n/g, " "));
    }
  }
} else {
  console.log("✅ TABLA carruseles YA EXISTE. Filas:", data?.length ?? check?.length ?? 0);
}
