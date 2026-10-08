import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const SITE = "https://esenciadebelleza.es";
const PAGE = 1000;

interface VariacionFeed {
  id: string;
  sku: string;
  nombre_variacion: string;
  ean_code: string | null;
  precio_b2c: number;
  precio_comparar: number | null;
  stock: number;
  activa: boolean;
}

interface PadreFeed {
  id: string;
  nombre: string;
  slug: string;
  descripcion_general: string | null;
  seo_description: string | null;
  categoria: string;
  subcategoria: string | null;
  imagen_principal_url: string | null;
  marca: { nombre: string } | null;
  variaciones: VariacionFeed[] | null;
}

function esc(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function limpiarHTML(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 4800);
}

// ── Reescritura de títulos para búsqueda ────────────────────────────────────
// Fórmula: Marca + Tipo + Atributo + Tamaño — cláusula de beneficio.
// Google empareja la query del usuario con el título: el estilo "TINTE PLATINUM
// HIPERTIN 60ML 4.00..." pierde impresiones frente a "Tinte Hipertin Platinum 60 ml".

const TIPOS_INICIALES = new Set([
  "TINTE", "TINTES", "MASCARILLA", "MASCARILLAS", "CHAMPU", "CHAMPÚ", "AMPOLLA",
  "AMPOLLAS", "SECADOR", "SECADORES", "PLANCHA", "PLANCHAS", "ACONDICIONADOR",
  "SERUM", "SÉRUM", "ACEITE", "CREMA", "LECHE", "GEL", "LOCION", "LOCIÓN",
  "DESMAQUILLANTE", "TALCO", "PERFUME", "AMBIENTADOR", "JABON", "JABÓN",
  "EXFOLIANTE", "ESPUMA", "LACA", "DECOLORANTE", "OXIGENADA", "REVELADOR",
  "NEUTRALIZANTE", "BALSAMO", "BÁLSAMO", "SHAMPOO", "TALCO",
]);

const normalize = (t: string) =>
  t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w]/g, "");

function normalizarTamano(t: string): string {
  const m = t.match(/^(\d+)\s*(ml|gr|g|kg|ml\.|gr\.)$/i);
  if (!m) return t;
  const u = m[2].toLowerCase().replace(".", "");
  const unidad = u === "gr" || u === "g" ? "g" : u;
  return `${m[1]} ${unidad}`;
}

function titleCase(t: string): string {
  if (/^[A-Z0-9]{2,3}$/.test(t)) return t; // siglas y modelos: TFC, GHD, T98
  if (/^\d/.test(t)) return t;             // tallas y números
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}

const ACENTOS: [RegExp, string][] = [
  [/\bchampu\b/gi, "champú"],
  [/\bcaida\b/gi, "caída"],
  [/\banticaida\b/gi, "anticaída"],
  [/\banti-caida\b/gi, "anti-caída"],
  [/\blocion\b/gi, "loción"],
  [/\bjabon\b/gi, "jabón"],
  [/\bbalsamo\b/gi, "bálsamo"],
  [/\bserum\b/gi, "sérum"],
  [/\bacido\b/gi, "ácido"],
  [/\bexfoliante\b/gi, "exfoliante"],
];

function corregirAcentos(base: string): string {
  let s = base;
  for (const [re, rep] of ACENTOS) {
    s = s.replace(re, (m) =>
      m[0] === m[0].toUpperCase() && m[0] !== m[0].toLowerCase()
        ? rep.charAt(0).toUpperCase() + rep.slice(1)
        : rep
    );
  }
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function tituloFeed(nombre: string, marca: string, subcategoria: string, categoria: string): string {
  let tokens = nombre.trim().split(/\s+/).map(normalizarTamano);

  // Mover la marca justo después de la palabra de tipo inicial (Tinte Hipertin…)
  const brandTokens = marca.trim().split(/\s+/).filter(Boolean);
  if (brandTokens.length && TIPOS_INICIALES.has(normalize(tokens[0] ?? "").toUpperCase())) {
    const nb = brandTokens.map(normalize);
    outer: for (let i = 1; i + nb.length <= tokens.length; i++) {
      for (let j = 0; j < nb.length; j++) {
        if (normalize(tokens[i + j]) !== nb[j]) continue outer;
      }
      const run = tokens.splice(i, nb.length);
      tokens.splice(1, 0, ...run);
      break;
    }
  }

  const base = corregirAcentos(tokens.map(titleCase).join(" "));
  return `${base} — ${clauseBeneficio(nombre, subcategoria, categoria)}`.slice(0, 150);
}

function clauseBeneficio(nombre: string, subcategoria: string, categoria: string): string {
  const s = `${nombre} ${subcategoria} ${categoria}`.toLowerCase();
  if (/(anticaida|anti-caida|anti caida|caida)/.test(s)) return "Tratamiento para la caída del pelo";
  if (/tinte|coloracion|oxigenada|revelador|decolor/.test(s)) return "Coloración profesional de peluquería";
  if (/champu/.test(s)) return "Champú profesional de peluquería";
  if (/mascarilla/.test(s)) return "Mascarilla profesional de peluquería";
  if (/ampoll/.test(s)) return "Tratamiento en vial de peluquería profesional";
  if (/plancha|secador|difusor|rizador/.test(s)) return "Utensilio de peluquería de uso profesional";
  if (/ambientador/.test(s)) return "Ambientador y fragancia para el hogar";
  if (/perfume|edp|eau de|colonia/.test(s)) return "Perfume y perfumería fina";
  if (/crema|serum|leche|gel|exfoliante|desmaquill|tonico|micelar|masaje|depil|parafina/.test(s))
    return "Cosmética profesional de estética";
  return "Producto profesional de peluquería";
}

function productTypeFeed(p: PadreFeed): string {
  if (/ambientador/i.test(p.nombre)) return "perfumeria > ambientadores";
  if (/perfume|eau de|\bedp\b/i.test(p.nombre)) return "perfumeria > perfumes";
  return `${p.categoria} > ${p.subcategoria}`;
}

// Feed Google Merchant Center (listados gratuitos). Una fila por producto.
export async function GET() {
  const supabase = createAdminClient();

  const padres: PadreFeed[] = [];
  for (let desde = 0; ; desde += PAGE) {
    const { data, error } = await supabase
      .from("productos_padre")
      .select(
        `id, nombre, slug, descripcion_general, seo_description, categoria, subcategoria,
         imagen_principal_url, marca:marcas(nombre),
         variaciones:productos_variaciones(id, sku, nombre_variacion, ean_code, precio_b2c, precio_comparar, stock, activa)`
      )
      .eq("activo", true)
      .eq("exclude_merchant", false)
      .not("subcategoria", "is", null)
      .order("id", { ascending: true })
      .range(desde, desde + PAGE - 1);

    if (error) {
      return new NextResponse("feed error: " + error.message, { status: 500 });
    }
    padres.push(...(((data ?? []) as unknown as PadreFeed[])));
    if (!data || data.length < PAGE) break;
  }

  const lineas: string[] = [
    "id,title,description,link,image_link,availability,price,sale_price,brand,condition,identifier_exists,gtin,product_type",
  ];

  for (const p of padres) {
    const vars = (p.variaciones ?? []).filter((v) => v.activa);
    if (vars.length === 0 || !p.imagen_principal_url) continue;

    const ordenadas = [...vars].sort((a, b) => a.precio_b2c - b.precio_b2c);
    const ref = ordenadas.find((v) => v.stock > 0) ?? ordenadas[0];
    const enStock = vars.some((v) => v.stock > 0);
    const ean = vars.map((v) => v.ean_code).find((e) => e) ?? "";
    const enOferta = ref.precio_comparar != null && ref.precio_comparar > ref.precio_b2c;

    const descripcion = limpiarHTML(p.descripcion_general || p.seo_description || p.nombre);
    const titulo = tituloFeed(p.nombre, p.marca?.nombre ?? "", p.subcategoria ?? "", p.categoria);

    lineas.push(
      [
        esc(p.id),
        esc(titulo),
        esc(`${titulo.split(" — ")[0]}. ${descripcion}`.slice(0, 4800)),
        esc(`${SITE}/productos/${p.categoria}/${p.subcategoria}/${p.slug}`),
        esc(p.imagen_principal_url),
        enStock ? "in stock" : "out of stock",
        esc(enOferta ? `${ref.precio_comparar!.toFixed(2)} EUR` : `${ref.precio_b2c.toFixed(2)} EUR`),
        esc(enOferta ? `${ref.precio_b2c.toFixed(2)} EUR` : ""),
        esc(p.marca?.nombre ?? ""),
        "new",
        ean ? "true" : "false",
        esc(ean),
        esc(productTypeFeed(p)),
      ].join(",")
    );
  }

  return new NextResponse(lineas.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
