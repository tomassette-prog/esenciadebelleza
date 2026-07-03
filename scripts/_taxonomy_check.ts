import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

async function main() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const content = fs.readFileSync("./lib/categorias.ts", "utf8");
  const navPairs = new Set<string>();
  content.split("\n").forEach((line) => {
    const m = line.match(/href:\s*"\/productos\/([\w-]+)\/([\w-]+)"/);
    if (m) navPairs.add(m[1] + "/" + m[2]);
  });

  const r = await sb.from("productos_padre").select("categoria,subcategoria,activo");
  const all = (r.data ?? []) as { categoria: string; subcategoria: string | null; activo: boolean }[];
  const activeDb = new Set(all.filter((p) => p.activo).map((p) => p.categoria + "/" + (p.subcategoria || "")));

  console.log("=== EN BD (activos) PERO NO EN NAV — URLs huérfanas del menú ===");
  [...activeDb]
    .filter((p) => !navPairs.has(p))
    .sort()
    .forEach((p) => {
      const cnt = all.filter((x) => x.activo && x.categoria + "/" + x.subcategoria === p).length;
      console.log("  " + p + "  (" + cnt + " productos)");
    });

  console.log("\n=== EN NAV PERO SIN PRODUCTOS ACTIVOS — links vacíos ===");
  [...navPairs]
    .filter((p) => !activeDb.has(p))
    .sort()
    .forEach((p) => console.log("  " + p));
}
main();
