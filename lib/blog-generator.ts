/**
 * lib/blog-generator.ts
 *
 * Generador automático de posts del blog para Esencia de Belleza.
 *   1. Keyword research: genera keywords candidatas desde productos + categorías
 *   2. Selección: elige la keyword del día (rota, evita repetir)
 *   3. Generación: crea el post con Gemini
 *
 * Usado por: app/api/cron/blog-diario/route.ts
 */

import { createClient } from "@supabase/supabase-js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BlogPostDraft {
  titulo: string;
  slug: string;
  resumen: string;
  contenido_html: string;
  seo_title: string;
  seo_description: string;
  keywords: string;
}

interface KeywordCandidate {
  keyword: string;
  tipo: "producto" | "categoria" | "comparativa" | "consejo" | "tendencia";
  productos_relacionados: string[];
}

// ─── Supabase client ─────────────────────────────────────────────────────────

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// ─── 1. Keyword Research ─────────────────────────────────────────────────────

/**
 * Genera keywords candidatas basándose en los productos y categorías de la tienda.
 */
export async function generarKeywordsCandidatas(): Promise<KeywordCandidate[]> {
  const supabase = getSupabase();
  const candidates: KeywordCandidate[] = [];

  // Obtener productos activos con marca
  const { data: productos } = await supabase
    .from("productos_padre")
    .select("nombre, categoria, subcategoria, marcas(nombre)")
    .eq("activo", true)
    .not("marca_id", "is", null)
    .limit(500);

  // Obtener categorías con conteo
  const { data: categorias } = await supabase
    .from("productos_padre")
    .select("categoria, subcategoria")
    .eq("activo", true);

  // Contar productos por subcategoría
  const subcatCounts: Record<string, number> = {};
  categorias?.forEach((p) => {
    const key = `${p.categoria}/${p.subcategoria}`;
    subcatCounts[key] = (subcatCounts[key] || 0) + 1;
  });

  // ── Keywords de tipo "producto" ──────────────────────────────────────────
  // Ej: "mejor champú anticaspa", "tinte sin amoniaco profesional"
  const tiposProducto = [
    { pattern: /CHAMP[UÚ]/i, base: "champú", cat: "peluqueria/champus" },
    { pattern: /TINTE/i, base: "tinte", cat: "peluqueria/tintes" },
    { pattern: /MASCARILLA/i, base: "mascarilla capilar", cat: "peluqueria/mascarillas" },
    { pattern: /ACONDICIONADOR/i, base: "acondicionador", cat: "peluqueria/acondicionadores" },
    { pattern: /PLANCHAS?/i, base: "planchas para el pelo", cat: "peluqueria/secadores-y-planchas" },
    { pattern: /SECADOR/i, base: "secador de pelo", cat: "peluqueria/secadores-y-planchas" },
    { pattern: /TIJERA/i, base: "tijeras de peluquero", cat: "peluqueria/tijeras" },
    { pattern: /DECOLOR/i, base: "decoloración capilar", cat: "peluqueria/decoloracion" },
    { pattern: /LACA/i, base: "laca para el pelo", cat: "peluqueria/lacas" },
    { pattern: /ESPUMA/i, base: "espuma de fijación", cat: "peluqueria/espumas" },
    { pattern: /CREMA FACIAL/i, base: "crema facial", cat: "estetica/cremas-faciales" },
    { pattern: /SERUM/i, base: "sérum capilar", cat: "peluqueria/ampollas-y-serums" },
    { pattern: /PERFUME|EDP|EAU DE PARFUM/i, base: "perfume", cat: "perfumeria/eau-de-parfum" },
    { pattern: /BARBER/i, base: "productos de barbería", cat: "barberia/cuidado-caballero" },
    { pattern: /KERATINA/i, base: "tratamiento de keratina", cat: "peluqueria/tratamientos" },
    { pattern: /OLAPLEX/i, base: "olaplex", cat: "peluqueria/tratamientos" },
    { pattern: /OXIGENADA/i, base: "oxigenada", cat: "peluqueria/oxigenadas" },
  ];

  const templatesProducto = [
    "mejor {base} profesional",
    "{base} profesional recomendado",
    "{base} para {problema}",
    "cuál es el mejor {base}",
    "{base} de calidad profesional",
  ];

  const problemas = [
    "pelo seco", "pelo graso", "pelo dañado", "pelo rizado", "pelo liso",
    "cabello teñido", "caspa", "caída del pelo", "pelo sin brillo",
    "pelo encrespado", "puntas abiertas", "cabello fino", "cabello grueso",
  ];

  for (const tipo of tiposProducto) {
    const productosTipo = productos?.filter((p) => tipo.pattern.test(p.nombre)) ?? [];
    if (productosTipo.length === 0) continue;

    for (const template of templatesProducto) {
      if (template.includes("{problema}")) {
        for (const problema of problemas.slice(0, 3)) {
          candidates.push({
            keyword: template.replace("{base}", tipo.base).replace("{problema}", problema),
            tipo: "producto",
            productos_relacionados: productosTipo.slice(0, 3).map((p) => p.nombre),
          });
        }
      } else {
        candidates.push({
          keyword: template.replace("{base}", tipo.base),
          tipo: "producto",
          productos_relacionados: productosTipo.slice(0, 3).map((p) => p.nombre),
        });
      }
    }
  }

  // ── Keywords de tipo "comparativa" ───────────────────────────────────────
  // Ej: "diferencia entre tinte permanente y semipermanente"
  const comparativas = [
    "diferencia entre tinte permanente y semipermanente",
    "decoloración vs mechas: cuál es mejor",
    "queratina brasileña vs botox capilar",
    "planchas de cerámica vs titanio",
    "champú sin sulfatos vs champú normal",
    "olaplex vs k18: cuál funciona mejor",
    "tinte profesional vs tinte del supermercado",
    "secador de pelo profesional vs normal",
    "mascarilla capilar vs acondicionador: diferencias",
    "laca vs gel vs cera: cuál elegir",
  ];

  comparativas.forEach((kw) => {
    candidates.push({ keyword: kw, tipo: "comparativa", productos_relacionados: [] });
  });

  // ── Keywords de tipo "consejo" ───────────────────────────────────────────
  // Ej: "cómo cuidar el pelo teñido"
  const consejos = [
    "cómo cuidar el pelo teñido en casa",
    "cómo aplicar una mascarilla capilar correctamente",
    "cómo usar ampollas capilares paso a paso",
    "rutina capilar para pelo dañado",
    "cómo proteger el pelo del sol en verano",
    "cómo hacer una decoloración sin dañar el pelo",
    "consejos para pelo rizado definido",
    "cómo eliminar el amarillo del pelo decolorado",
    "cómo hidratar el pelo seco y maltratado",
    "cómo elegir el champú adecuado para tu tipo de pelo",
    "cómo hacer mechas en casa paso a paso",
    "rutina de cuidado capilar semanal profesional",
  ];

  consejos.forEach((kw) => {
    candidates.push({ keyword: kw, tipo: "consejo", productos_relacionados: [] });
  });

  // ── Keywords de tipo "tendencia" ─────────────────────────────────────────
  const tendencias = [
    "tendencias de coloración capilar 2026",
    "cortes de pelo de moda 2026",
    "tratamientos capilares más efectivos 2026",
    "productos de peluquería que usan los profesionales",
    "marcas de peluquería profesional más vendidas",
    "nuevos tratamientos capilares del año",
    "tendencias en barbería masculina 2026",
    "perfumes árabes más populares en España",
    "maquillaje natural tendencia 2026",
    "skincare profesional para el rostro",
  ];

  tendencias.forEach((kw) => {
    candidates.push({ keyword: kw, tipo: "tendencia", productos_relacionados: [] });
  });

  return candidates;
}

// ─── 2. Selección de keyword ─────────────────────────────────────────────────

/**
 * Selecciona la keyword del día evitando las ya usadas en posts recientes.
 */
export async function seleccionarKeyword(
  candidates: KeywordCandidate[]
): Promise<KeywordCandidate> {
  const supabase = getSupabase();

  // Obtener keywords de posts recientes (últimos 30 días)
  const { data: recentPosts } = await supabase
    .from("posts")
    .select("keywords")
    .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
    .order("created_at", { ascending: false });

  const usedKeywords = new Set<string>();
  recentPosts?.forEach((p) => {
    if (p.keywords) {
      p.keywords.split(",").forEach((kw: string) => usedKeywords.add(kw.trim().toLowerCase()));
    }
  });

  // Filtrar keywords no usadas
  const available = candidates.filter(
    (c) => !usedKeywords.has(c.keyword.toLowerCase())
  );

  if (available.length === 0) {
    // Si todas están usadas, elegir una aleatoria
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  // Priorizar: consejo > comparativa > tendencia > producto
  const priority: Record<string, number> = { consejo: 4, comparativa: 3, tendencia: 2, producto: 1 };
  available.sort((a, b) => (priority[b.tipo] || 0) - (priority[a.tipo] || 0));

  // Elegir entre los top 5 para variedad
  const top = available.slice(0, Math.min(5, available.length));
  return top[Math.floor(Math.random() * top.length)];
}

// ─── 3. Generación de contenido con Gemini ───────────────────────────────────

/**
 * Genera un post del blog usando Gemini.
 */
export async function generarPostConGemini(
  keyword: KeywordCandidate,
  productosContexto: string[]
): Promise<BlogPostDraft> {
  const apiKey = process.env.GEMINI_API_KEY!;
  const model = "gemini-flash-latest";

  const productosInfo = productosContexto.length > 0
    ? `\n\nProductos de la tienda que puedes mencionar (enlaza con [ENLACE_PRODUCTO: NOMBRE]):\n${productosContexto.map((p) => `- ${p}`).join("\n")}`
    : "";

  const prompt = `Eres un experto en SEO y contenido para una tienda online de peluquería y estética profesional en España (esenciadebelleza.es).

Genera un post de blog optimizado SEO para la keyword: "${keyword.keyword}"

REGLAS IMPORTANTES:
1. El post debe ser ÚTIL y INFORMATIVO, no solo publicitario
2. Mínimo 800 palabras de contenido real
3. Usa H2 y H3 para estructurar
4. Incluye una tabla comparativa si es relevante
5. Enlaza productos de la tienda usando [ENLACE_PRODUCTO: NOMBRE DEL PRODUCTO]
6. Incluye una sección FAQ al final con 3-5 preguntas frecuentes
7. El tono debe ser profesional pero cercano, como un experto que aconseja
8. NO inventes productos que no existen
9. Usa keywords relacionadas de forma natural
10. El contenido debe estar en español de España${productosInfo}

FORMATO DE RESPUESTA — JSON estricto:
{
  "titulo": "Título atractivo con keyword (máx 60 chars)",
  "slug": "slug-seo-friendly",
  "resumen": "Resumen de 150-200 chars para la tarjeta del blog",
  "contenido_html": "HTML completo del post con H2, H3, párrafos, listas, tablas, FAQ en <details><summary>",
  "seo_title": "Title tag SEO (máx 60 chars, incluir keyword)",
  "seo_description": "Meta description SEO (máx 160 chars, incluir keyword y CTA)",
  "keywords": "keyword1, keyword2, keyword3, keyword4, keyword5"
}

SOLO devuelve el JSON, sin texto adicional.`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 8192,
          responseMimeType: "application/json",
        },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) throw new Error("Gemini devolvió respuesta vacía");

  // Parsear JSON
  let post: BlogPostDraft;
  try {
    post = JSON.parse(text);
  } catch {
    // Intentar extraer JSON del texto
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No se pudo parsear la respuesta de Gemini");
    post = JSON.parse(jsonMatch[0]);
  }

  // Validar campos obligatorios
  if (!post.titulo || !post.contenido_html || !post.seo_title) {
    throw new Error("Respuesta de Gemini incompleta: faltan campos obligatorios");
  }

  // Limpiar HTML
  post.contenido_html = limpiarHtml(post.contenido_html);

  // Generar slug si no viene
  if (!post.slug) {
    post.slug = post.titulo
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .substring(0, 80);
  }

  return post;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function limpiarHtml(html: string): string {
  return html
    // Eliminar code blocks de markdown
    .replace(/```html\s*/g, "")
    .replace(/```\s*/g, "")
    // Limpiar espacios múltiples
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Obtiene productos relacionados con una keyword para enlazar en el post.
 */
export async function obtenerProductosRelacionados(
  keyword: string,
  limit = 5
): Promise<string[]> {
  const supabase = getSupabase();

  // Buscar productos que coincidan con la keyword
  const { data } = await supabase
    .from("productos_padre")
    .select("nombre, marcas(nombre)")
    .eq("activo", true)
    .or(`nombre.ilike.%${keyword.split(" ")[0]}%,subcategoria.ilike.%${keyword.split(" ")[0]}%`)
    .limit(limit);

  return data?.map((p) => p.nombre) ?? [];
}
