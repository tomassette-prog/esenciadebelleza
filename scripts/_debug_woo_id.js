const { createClient } = require("@supabase/supabase-js");

// Load env vars from .env.local manually
const fs = require("fs");
const envFile = fs.readFileSync(".env.local", "utf8");
const env = {};
envFile.split("\n").forEach((line) => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim();
});

const s = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  const { count: total } = await s
    .from("productos_padre")
    .select("*", { count: "exact", head: true });
  const { count: conWooId } = await s
    .from("productos_padre")
    .select("*", { count: "exact", head: true })
    .not("woo_id", "is", null);
  const { count: conWcProductId } = await s
    .from("productos_padre")
    .select("*", { count: "exact", head: true })
    .not("wc_product_id", "is", null)
    .catch(() => ({ count: 0 }));

  const { data: sample } = await s
    .from("productos_padre")
    .select("slug, woo_id, nombre, id")
    .limit(10);

  console.log("=== DEBUG WOO_ID ===");
  console.log("Total productos_padre:", total);
  console.log("Con woo_id:", conWooId);
  console.log("Sin woo_id:", (total || 0) - (conWooId || 0));
  console.log(
    "% con woo_id:",
    total > 0 ? Math.round((conWooId / total) * 100) + "%" : "N/A"
  );
  console.log("\nSample (first 10):");
  console.log(JSON.stringify(sample, null, 2));

  // Check slugs: how many match WC slugs?
  // Let's see some products with and without woo_id
  const { data: sinWooId } = await s
    .from("productos_padre")
    .select("slug, nombre, id")
    .is("woo_id", null)
    .limit(5);
  console.log("\nSample SIN woo_id (first 5):");
  console.log(JSON.stringify(sinWooId, null, 2));
})();
