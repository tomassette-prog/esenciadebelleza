// Apply price/offer changes directly via Supabase REST API
const SUPABASE_URL = "https://yjanobsfzcwpusynvlun.supabase.co";
const WOO_URL = "https://depeluqueriaproductos.com";

import { readFileSync } from "fs";

// Load env
let envContent;
try { envContent = readFileSync(".env.production.local", "utf8"); } catch { envContent = ""; }
const env = {};
envContent.split("\n").forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, "");
});

const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
const wooKey = env.WOO_CONSUMER_KEY;
const wooSecret = env.WOO_CONSUMER_SECRET;

if (!serviceKey || !wooKey || !wooSecret) {
  console.error("Missing env vars");
  process.exit(1);
}

const wooAuth = Buffer.from(`${wooKey}:${wooSecret}`).toString("base64");

// Fetch products from WooCommerce
async function fetchWoo(page = 1) {
  const res = await fetch(`${WOO_URL}/wp-json/wc/v3/products?per_page=100&page=${page}&status=publish`, {
    headers: { Authorization: `Basic ${wooAuth}` }
  });
  if (!res.ok) throw new Error(`WC ${res.status}`);
  return res.json();
}

// Update product in Supabase
async function updateProduct(slug, updates) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/productos_padre?slug=eq.${slug}`, {
    method: "PATCH",
    headers: {
      "apikey": serviceKey,
      "Authorization": `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      "Prefer": "return=minimal"
    },
    body: JSON.stringify(updates)
  });
  return res.ok;
}

// Update variation in Supabase
async function updateVariation(sku, updates) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/productos_variaciones?sku=eq.${sku}`, {
    method: "PATCH",
    headers: {
      "apikey": serviceKey,
      "Authorization": `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      "Prefer": "return=minimal"
    },
    body: JSON.stringify(updates)
  });
  return res.ok;
}

// Get all products from Supabase
async function getSupabaseProducts() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/productos_padre?activo=eq.true&select=slug,woo_id,oferta,variaciones:productos_variaciones(sku,precio_b2c,precio_comparar,activa)`, {
    headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}` }
  });
  return res.json();
}

function slugify(text) {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

async function main() {
  console.log("Fetching Supabase products...");
  const supaProducts = await getSupabaseProducts();
  const supaMap = new Map(supaProducts.map(p => [p.slug, p]));
  const supaWooMap = new Map(supaProducts.filter(p => p.woo_id).map(p => [p.woo_id, p]));

  console.log(`Supabase: ${supaProducts.length} products`);

  let page = 1;
  let totalUpdated = 0;
  let totalOffersUpdated = 0;

  while (true) {
    console.log(`Fetching WC page ${page}...`);
    const wooProducts = await fetchWoo(page);
    if (!wooProducts.length) break;

    for (const wp of wooProducts) {
      const slug = wp.slug || slugify(wp.name);
      const wooPrice = parseFloat(wp.regular_price || wp.price) || 0;
      const wooSalePrice = parseFloat(wp.sale_price) || 0;
      const isOferta = wooSalePrice > 0 && wooSalePrice < wooPrice;

      // Find in Supabase by woo_id or slug
      const supaP = supaWooMap.get(wp.id) || supaMap.get(slug);
      if (!supaP) continue;

      // Check if offer changed
      if (supaP.oferta !== isOferta) {
        await updateProduct(supaP.slug, { oferta: isOferta });
        totalOffersUpdated++;
      }

      // Update variation prices
      if (wp.type === "simple" && wp.sku) {
        const precioRegular = wooPrice;
        const precioComparar = isOferta ? precioRegular : null;
        const precioB2c = isOferta ? wooSalePrice : wooPrice;

        await updateVariation(wp.sku, {
          precio_b2c: precioB2c,
          precio_comparar: precioComparar
        });
        totalUpdated++;
      }
    }

    console.log(`  Page ${page}: ${wooProducts.length} products processed`);
    page++;
    if (wooProducts.length < 100) break;
  }

  console.log(`\n✅ Done!`);
  console.log(`   - ${totalUpdated} variations updated`);
  console.log(`   - ${totalOffersUpdated} offer flags updated`);
}

main().catch(console.error);
