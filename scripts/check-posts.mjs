import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
}

const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const { data } = await supa
  .from("posts")
  .select("id, titulo, created_at, publicado")
  .order("created_at", { ascending: false })
  .limit(5);

console.log("Últimos posts:");
for (const p of data ?? []) {
  console.log(`  ${p.created_at} | ${p.publicado ? "PUBLICADO" : "BORRADOR"} | ${p.titulo}`);
}
