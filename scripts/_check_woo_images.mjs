// Verifica rápidamente si 2 productos de Woo tienen imagen
import { readFileSync } from "fs";

const envFile = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
for (const line of envFile.split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].replace(/^"|"$/g, "").trim();
}

const WOO_URL = "https://depeluqueriaproductos.com";
const CK = "admin";
const CS = "pzzcxThjVHhCEtaO36UgyZ8N";
const auth = Buffer.from(`${CK}:${CS}`).toString("base64");

const ids = [20669, 12569];
for (const id of ids) {
  try {
    const res = await fetch(`${WOO_URL}/wp-json/wc/v3/products/${id}`, {
      headers: {
        Authorization: `Basic ${auth}`,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/148.0.0.0 Safari/537.36",
        "Accept": "application/json",
      },
    });
    const text = await res.text();
    try {
      const p = JSON.parse(text);
      console.log(`#${id}`, JSON.stringify({ name: p.name, images: p.images, code: p.code, msg: p.message }).slice(0, 400));
    } catch {
      console.log(`#${id} NO JSON (${res.status}) primeros 80 chars: ${text.slice(0, 80)}`);
    }
  } catch (e) {
    console.log(`#${id} error:`, e.message);
  }
}
