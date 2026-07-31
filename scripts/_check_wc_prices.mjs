const WOO_URL = 'https://depeluqueriaproductos.com';
const auth = Buffer.from('admin:pzzcxThjVHhCEtaO36UgyZ8N').toString('base64');

const searches = [
  'ECOBRITE MULTI-STYLER',
  'SCHWARZKOPF IGORA ROYAL 5-6',
  'TAHE ORGANIC CARE 8.23',
  'ALAN COAR TONICO SECO',
  'LIHETO FUNNY SHAMPOO FRESA',
  'SALERM DECOLORANTE BLOND SUPREME',
  'PERFECT BEAUTY MINITINA',
];

for (const search of searches) {
  const res = await fetch(`${WOO_URL}/wp-json/wc/v3/products?search=${encodeURIComponent(search)}&per_page=3`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  const data = await res.json();
  if (!Array.isArray(data)) {
    console.log(`[${search}] → Status ${res.status}: ${JSON.stringify(data).substring(0, 200)}`);
    continue;
  }
  for (const p of data) {
    console.log(`${p.name} | price:"${p.price}" regular:"${p.regular_price}" sale:"${p.sale_price}" stock:${p.stock_status} type:${p.type} sku:${p.sku}`);
  }
  if (data.length === 0) console.log(`[${search}] → no results in WC`);
  console.log('---');
}
