import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";
import { slugifyCategoria } from "@/lib/seo";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const BASE = "https://esenciadebelleza.es";
  const supabase = await createClient();

  const { data: productos } = await supabase
    .from("productos_padre")
    .select("slug, categoria, subcategoria, updated_at")
    .eq("activo", true);

  const productUrls: MetadataRoute.Sitemap = (productos ?? []).map((p) => ({
    url: `${BASE}/productos/${slugifyCategoria(p.categoria)}/${slugifyCategoria(p.subcategoria ?? "general")}/${p.slug}`,
    lastModified: new Date(p.updated_at),
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  // Categorías únicas
  const categorias = [...new Set((productos ?? []).map((p) => p.categoria))];
  const catUrls: MetadataRoute.Sitemap = categorias.map((cat) => ({
    url: `${BASE}/productos/${slugifyCategoria(cat)}`,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  // Subcategorías únicas (combinaciones categoria+subcategoria)
  const subcatSet = new Set<string>();
  for (const p of productos ?? []) {
    if (p.subcategoria) {
      subcatSet.add(`${p.categoria}|||${p.subcategoria}`);
    }
  }
  const subcatUrls: MetadataRoute.Sitemap = [...subcatSet].map((key) => {
    const [cat, sub] = key.split("|||");
    return {
      url: `${BASE}/productos/${slugifyCategoria(cat)}/${slugifyCategoria(sub)}`,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    };
  });

  // Marcas
  const { data: marcas } = await supabase
    .from("marcas")
    .select("slug, updated_at");

  const marcaUrls: MetadataRoute.Sitemap = (marcas ?? []).map((m) => ({
    url: `${BASE}/marcas/${m.slug}`,
    lastModified: m.updated_at ? new Date(m.updated_at) : undefined,
    changeFrequency: "weekly" as const,
    priority: 0.5,
  }));

  const staticUrls: MetadataRoute.Sitemap = [
    { url: BASE, changeFrequency: "monthly" as const, priority: 1.0 },
    { url: `${BASE}/productos`, changeFrequency: "weekly" as const, priority: 0.9 },
    { url: `${BASE}/marcas`, changeFrequency: "weekly" as const, priority: 0.6 },
    { url: `${BASE}/profesionales`, changeFrequency: "monthly" as const, priority: 0.7 },
  ];

  return [...staticUrls, ...catUrls, ...subcatUrls, ...marcaUrls, ...productUrls];
}
