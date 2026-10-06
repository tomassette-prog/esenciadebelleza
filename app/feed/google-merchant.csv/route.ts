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

    lineas.push(
      [
        esc(p.id),
        esc(p.nombre),
        esc(descripcion),
        esc(`${SITE}/productos/${p.categoria}/${p.subcategoria}/${p.slug}`),
        esc(p.imagen_principal_url),
        enStock ? "in stock" : "out of stock",
        esc(enOferta ? `${ref.precio_comparar!.toFixed(2)} EUR` : `${ref.precio_b2c.toFixed(2)} EUR`),
        esc(enOferta ? `${ref.precio_b2c.toFixed(2)} EUR` : ""),
        esc(p.marca?.nombre ?? ""),
        "new",
        ean ? "true" : "false",
        esc(ean),
        esc(`${p.categoria} > ${p.subcategoria}`),
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
