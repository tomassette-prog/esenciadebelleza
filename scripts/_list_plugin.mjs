const auth = Buffer.from("admin:pzzcxThjVHhCEtaO36UgyZ8N").toString("base64");

// Try to list files in the plugin directory
const paths = [
  "/wp-content/plugins/cecabank-woocommerce/",
  "/wp-content/plugins/cecabank-woocommerce/includes/",
  "/wp-content/plugins/cecabank-woocommerce/class-wc-gateway-cecabank.php",
  "/wp-content/plugins/cecabank-woocommerce/includes/class-wc-gateway-cecabank.php",
  "/wp-content/plugins/cecabank-woocommerce/lib/class-cecabank-signature.php",
  "/wp-content/plugins/cecabank-woocommerce/src/Signature.php",
  "/wp-content/plugins/cecabank-woocommerce/classes/class-cecabank-signature.php",
];

for (const p of paths) {
  try {
    const resp = await fetch("https://depeluqueriaproductos.com" + p, {
      headers: { Authorization: `Basic ${auth}` },
      signal: AbortSignal.timeout(5000),
      redirect: "manual",
    });
    console.log(`${resp.status} ${p} (${resp.headers.get("content-length") || "?"} bytes)`);
    if (resp.ok) {
      const text = await resp.text();
      if (text.length > 0) {
        console.log(`  Content (${text.length} bytes): ${text.substring(0, 500)}`);
      }
    }
  } catch (e) {
    console.log(`ERR ${p}: ${e.message}`);
  }
}
