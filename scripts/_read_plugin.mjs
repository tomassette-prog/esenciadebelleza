const auth = Buffer.from("admin:pzzcxThjVHhCEtaO36UgyZ8N").toString("base64");

const resp = await fetch("https://depeluqueriaproductos.com/wp-content/plugins/cecabank-woocommerce/wc_gateway_cecabank.php", {
  headers: { Authorization: `Basic ${auth}` },
  signal: AbortSignal.timeout(10000),
});
console.log("Status:", resp.status);
const text = await resp.text();
console.log("Length:", text.length);
console.log(text.substring(0, 4000));
