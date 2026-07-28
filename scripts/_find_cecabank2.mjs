const auth = Buffer.from("admin:pzzcxThjVHhCEtaO36UgyZ8N").toString("base64");

// Try to find the plugin directory by listing wp-content/plugins/
try {
  const resp = await fetch("https://depeluqueriaproductos.com/wp-content/plugins/", {
    headers: { Authorization: `Basic ${auth}` },
    signal: AbortSignal.timeout(5000),
  });
  const text = await resp.text();
  // Find all links that might contain cecabank
  const matches = text.match(/href="[^"]*cecabank[^"]*"/gi) || [];
  console.log("Cecabank links:", matches);
  
  // Also look for any directory listing
  const dirMatch = text.match(/href="([^"]*\/)"/g) || [];
  console.log("Directories found:", dirMatch.length);
  dirMatch.forEach(m => {
    if (m.toLowerCase().includes("ceca") || m.toLowerCase().includes("tpv") || m.toLowerCase().includes("payment") || m.toLowerCase().includes("gateway")) {
      console.log("  ", m);
    }
  });
} catch (e) {
  console.log("Error listing plugins dir:", e.message);
}

// Try the WooCommerce REST API to get payment gateways
try {
  const resp = await fetch("https://depeluqueriaproductos.com/wp-json/wc/v3/payment_gateways", {
    headers: { Authorization: `Basic ${auth}` },
    signal: AbortSignal.timeout(5000),
  });
  const data = await resp.json();
  if (Array.isArray(data)) {
    data.forEach(gw => {
      if (gw.id && gw.id.includes("ceca")) {
        console.log("Gateway:", gw.id, gw.title, gw.description);
        console.log("Settings:", JSON.stringify(gw.settings || gw, null, 2).substring(0, 1000));
      }
    });
  } else {
    console.log("WC API response:", JSON.stringify(data).substring(0, 500));
  }
} catch (e) {
  console.log("Error with WC API:", e.message);
}
