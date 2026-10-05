/**
 * scripts/seo-ia-batch.ts
 *
 * Enriquece los campos SEO de los productos (seo_title, seo_description,
 * texto_enriquecido_seo) con Gemini: textos únicos por producto en lugar de
 * las plantillas de lib/seo-generator.ts.
 *
 * Uso:
 *   npm run seo:ia -- --limite=5      ← prueba con 5 productos
 *   npm run seo:ia                    ← catálogo completo
 *   npm run seo:ia -- --solo-vacios   ← solo productos sin texto_enriquecido_seo
 *
 * Requiere: NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en el entorno.
 * GEMINI_API_KEY se toma del entorno o de add-env-prod.js (fallback de desarrollo).
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { join } from "path";

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://yjanobsfzcwpusynvlun.supabase.co";
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  || (readFileSync(join(__dirname, "..", "add-env-prod.js"), "utf8").match(/eyJ[A-Za-z0-9_\-\.]{150,}/)?.[0] ?? "");

let geminiKey = process.env.GEMINI_API_KEY
  || (readFileSync(join(__dirname, "..", "add-env-prod.js"), "utf8").match(/AQ\.[A-Za-z0-9_\-]{20,}/)?.[0] ?? "");

if (!SUPA_KEY || !geminiKey) {
  console.error("Faltan SUPABASE_SERVICE_ROLE_KEY o GEMINI_API_KEY");
  process.exit(1);
}

const supa = createClient(SUPA_URL, SUPA_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const argLimite = process.argv.find((a) => a.startsWith("--limite="));
const argDesde = process.argv.find((a) => a.startsWith("--desde="));
const LIMITE = argLimite ? parseInt(argLimite.split("=")[1], 10) : Infinity;
const DESDE = argDesde ? parseInt(argDesde.split("=")[1], 10) : 0;
const SOLO_VACIOS = process.argv.includes("--solo-vacios");
// gemini-3.8-flash da mejor calidad; los proyectos sin créditos solo dejan
// generaciones largas al modelo lite (503 en los demás)
const MODELOS = ["gemini-3.8-flash", "gemini-3.5-flash-lite"];
const CONCURRENCIA = 8;

let tokensEntrada = 0;
let tokensSalida = 0;
// Tras el primer 503 del modelo premium se descarta para el resto del lote
let premiumRoto = false;

const recortar = (s: string, max: number) =>
  (s.length <= max ? s : s.slice(0, max).replace(/\s+\S*$/, "").trim());

interface ProductoRow {
  id: string;
  nombre: string;
  categoria: string;
  subcategoria: string | null;
  descripcion_general: string | null;
  texto_enriquecido_seo: string | null;
  marca: { nombre: string } | null;
}

function promptDe(p: ProductoRow): string {
  const desc = (p.descripcion_general || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 2500);
  return `Eres experto en SEO para una tienda online de peluquería y estética profesional en España (esenciadebelleza.es).

Producto: ${p.nombre}${p.marca?.nombre ? ` (marca: ${p.marca.nombre})` : ""}
Categoría: ${p.categoria}${p.subcategoria ? ` / ${p.subcategoria}` : ""}
Descripción original del proveedor: ${desc || "(sin descripción)"}

Genera contenido SEO único y natural para la ficha del producto:
- "seo_title": máximo 60 caracteres, con la keyword principal del producto
- "seo_description": máximo 160 caracteres, con llamada a la acción
- "texto_enriquecido_seo": HTML válido con un <h2> principal y 2-3 secciones con <h2>/<h3> (por ejemplo: Descripción del producto, Modo de empleo o ventajas, Preguntas frecuentes). Párrafos de 2-4 frases, mínimo 250 palabras en total, tono profesional y cercano. NO inventes especificaciones que no consten en la descripción. Cierra mencionando "Disponible en Esencia de Belleza".

Devuelve SOLO JSON válido: {"seo_title":"","seo_description":"","texto_enriquecido_seo":""}`;
}

async function generarSeoIA(p: ProductoRow): Promise<{ seo_title: string; seo_description: string; texto_enriquecido_seo: string } | null> {
  const prompt = promptDe(p);
  for (let intento = 0; intento < 4; intento++) {
    const modelo = premiumRoto ? MODELOS[MODELOS.length - 1] : MODELOS[Math.min(intento, MODELOS.length - 1)];
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${geminiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.6, maxOutputTokens: 3072, responseMimeType: "application/json" },
      }),
    });
    const data = await res.json();
    if (data.usageMetadata) {
      tokensEntrada += data.usageMetadata.promptTokenCount || 0;
      tokensSalida += data.usageMetadata.candidatesTokenCount || 0;
    }
    if (!res.ok) {
      if (res.status === 429 || res.status === 503) {
        if (res.status === 503) premiumRoto = true;
        await new Promise((r) => setTimeout(r, 3000 * (intento + 1)));
        continue;
      }
      console.error(`  [${p.nombre.slice(0, 40)}] Gemini ${res.status}: ${JSON.stringify(data).slice(0, 150)}`);
      return null;
    }
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) continue;
    try {
      const json = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? text);
      if (json.seo_title && json.texto_enriquecido_seo) return json;
    } catch { /* reintentar */ }
  }
  return null;
}

async function main() {
  console.log("── Esencia de Belleza — SEO IA Batch ──");
  console.log(`Modo: ${SOLO_VACIOS ? "solo productos sin texto_enriquecido_seo" : "todos (sobreescribe)"}`);

  let todos: ProductoRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supa
      .from("productos_padre")
      .select("id, nombre, categoria, subcategoria, descripcion_general, texto_enriquecido_seo, marca:marcas(nombre)")
      .range(from, from + 999);
    if (error) { console.error("Error cargando productos:", error.message); process.exit(1); }
    todos.push(...(data as unknown as ProductoRow[]));
    if (!data || data.length < 1000) break;
  }

  const objetivo = (SOLO_VACIOS ? todos.filter((p) => !p.texto_enriquecido_seo) : todos)
    .slice(DESDE, Number.isFinite(LIMITE) ? DESDE + LIMITE : undefined);
  console.log(`Productos a procesar: ${objetivo.length} (catálogo total: ${todos.length})`);

  let ok = 0;
  let fallos = 0;
  let hechos = 0;

  async function procesar(p: ProductoRow) {
    const seo = await generarSeoIA(p);
    if (!seo) { fallos++; return; }
    const { error } = await supa
      .from("productos_padre")
      .update({
        seo_title: recortar(seo.seo_title, 60),
        seo_description: recortar(seo.seo_description, 155),
        texto_enriquecido_seo: seo.texto_enriquecido_seo,
      })
      .eq("id", p.id);
    if (error) { console.error(`  [${p.nombre.slice(0, 40)}] update: ${error.message}`); fallos++; return; }
    ok++;
    hechos++;
    if (hechos % 25 === 0) {
      const coste = (tokensEntrada / 1e6) * 0.30 + (tokensSalida / 1e6) * 2.50;
      console.log(`  Progreso: ${hechos}/${objetivo.length} — ok ${ok}, fallos ${fallos} — tokens ${tokensEntrada}/${tokensSalida} (≈ $${coste.toFixed(2)} a precio lite)`);
    }
  }

  const cola = [...objetivo];
  await Promise.all(Array.from({ length: CONCURRENCIA }, async () => {
    while (cola.length > 0) {
      const p = cola.shift();
      if (p) await procesar(p);
    }
  }));

  const costeLite = (tokensEntrada / 1e6) * 0.30 + (tokensSalida / 1e6) * 2.50;
  const costeFlash = (tokensEntrada / 1e6) * 0.75 + (tokensSalida / 1e6) * 3.75;
  console.log(`\n✓ Completado: ${ok} ok, ${fallos} fallos`);
  console.log(`  Tokens: ${tokensEntrada} entrada / ${tokensSalida} salida`);
  console.log(`  Coste ≈ $${costeLite.toFixed(2)} (solo lite) o $${costeFlash.toFixed(2)} (si 3.8-flash acepta las peticiones)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
