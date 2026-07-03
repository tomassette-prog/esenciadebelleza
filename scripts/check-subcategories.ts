import { createAdminClient } from "@/lib/supabase/admin";
import { NAV_ITEMS } from "@/lib/categorias";

async function main() {
  const supabase = createAdminClient();

  // Obtener todas las subcategorías de BD
  const { data: dbData } = await supabase
    .from("productos_padre")
    .select("categoria, subcategoria")
    .eq("activo", true);

  const dbSubcats = new Map<string, Set<string>>();
  for (const p of dbData ?? []) {
    if (!dbSubcats.has(p.categoria)) {
      dbSubcats.set(p.categoria, new Set());
    }
    if (p.subcategoria) {
      dbSubcats.get(p.categoria)!.add(p.subcategoria);
    }
  }

  // Extraer subcategorías de NAV_ITEMS
  const navSubcats = new Map<string, Set<string>>();
  for (const item of NAV_ITEMS) {
    if (item.columnas) {
      const catSlug = item.href.split("/")[2];
      if (!navSubcats.has(catSlug)) {
        navSubcats.set(catSlug, new Set());
      }
      for (const col of item.columnas) {
        for (const link of col.links) {
          const subSlug = link.href.split("/")[3];
          if (subSlug) {
            navSubcats.get(catSlug)!.add(subSlug);
          }
        }
      }
    }
  }

  console.log("\n=== COMPARACIÓN BD vs NAV_ITEMS ===\n");

  let discrepancias = 0;

  // Verificar si hay en BD pero NO en NAV
  for (const [cat, subs] of dbSubcats) {
    for (const sub of subs) {
      const navSubs = navSubcats.get(cat);
      if (!navSubs || !navSubs.has(sub)) {
        console.log(
          `❌ OCULTO: ${cat}/${sub} está en BD pero NO en nav (${subs.size} productos)`
        );
        discrepancias++;
      }
    }
  }

  // Verificar si hay en NAV pero NO en BD
  for (const [cat, subs] of navSubcats) {
    for (const sub of subs) {
      const dbSubs = dbSubcats.get(cat);
      if (!dbSubs || !dbSubs.has(sub)) {
        console.log(`⚠️  VACÍA: ${cat}/${sub} está en nav pero NO en BD`);
      }
    }
  }

  if (discrepancias === 0) {
    console.log("✅ TODO SINCRONIZADO: Todas las subcategorías de BD están en NAV");
  } else {
    console.log(`\n⚠️  Total de OCULTOS: ${discrepancias}`);
  }
}

main().catch(console.error);
