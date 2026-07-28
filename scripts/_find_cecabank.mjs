const auth = Buffer.from("admin:pzzcxThjVHhCEtaO36UgyZ8N").toString("base64");

const paths = [
  "/wp-content/plugins/cecabank-tpv-for-woocommerce/includes/class-wc-gateway-cecabank.php",
  "/wp-content/plugins/cecabank-tpv-for-woocommerce/includes/class-cecabank-gateway.php",
  "/wp-content/plugins/cecabank-tpv-for-woocommerce/cecabank-tpv-for-woocommerce.php",
  "/wp-content/plugins/cecabank-woocommerce/includes/class-cecabank-gateway.php",
  "/wp-content/plugins/cecabank/includes/class-cecabank-gateway.php",
  "/wp-content/plugins/wc-cecabank/includes/class-wc-gateway-cecabank.php",
  "/wp-content/plugins/woocommerce-gateway-cecabank/includes/class-wc-gateway-cecabank.php",
];

for (const p of paths) {
  try {
    const resp = await fetch("https://depeluqueriaproductos.com" + p, {
      headers: { Authorization: `Basic ${auth}` },
      signal: AbortSignal.timeout(5000),
    });
    if (resp.ok) {
      const data = await resp.text();
      if (data.length > 100) {
        console.log(`FOUND: ${p} (${data.length} bytes)`);
        const lines = data.split("\n");
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].toLowerCase().includes("firma") || lines[i].toLowerCase().includes("sha") || lines[i].toLowerCase().includes("signature") || lines[i].toLowerCase().includes("hash")) {
            console.log(`  L${i}: ${lines[i].trim().substring(0, 120)}`);
          }
        }
      }
    }
  } catch (e) {
    // not found or timeout
  }
}
console.log("Done");
