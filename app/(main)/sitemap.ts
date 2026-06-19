import type { MetadataRoute } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { slugifyCategoria } from "@/lib/seo";

export const revalidate = 3600;

// Carga todos los productos activos paginando de 1000 en 1000
async function fetchAllProductos() {
  const supabase = createAdminClient();
  const PAGE = 1000;
  let offset = 0;
  const todos: { slug: string; categoria: string; subcategoria: string | null; updated_at: string }[] = [];

  while (true) {
    const { data } = await supabase
      .from("productos_padre")
      .select("slug, categoria, subcategoria, updated_at")
      .eq("activo", true)
      .range(offset, offset + PAGE - 1);

    if (!data || data.length === 0) break;
    todos.push(...data);
    if (data.length < PAGE) break;
    offset += PAGE;
  }

  return todos;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const BASE = "https://esenciadebelleza.es";
  const supabase = createAdminClient();

  const [productos, marcasData, postsData] = await Promise.all([
    fetchAllProductos(),
    supabase.from("marcas").select("slug, updated_at").eq("activa", true),
    supabase.from("posts").select("slug, updated_at").eq("publicado", true),
  ]);

  // URLs de productos individuales
  const productUrls: MetadataRoute.Sitemap = productos.map((p) => ({
    url: `${BASE}/productos/${slugifyCategoria(p.categoria)}/${slugifyCategoria(p.subcategoria ?? "general")}/${p.slug}`,
    lastModified: new Date(p.updated_at),
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  // Categorías únicas
  const categorias = [...new Set(productos.map((p) => p.categoria))];
  const catUrls: MetadataRoute.Sitemap = categorias.map((cat) => ({
    url: `${BASE}/productos/${slugifyCategoria(cat)}`,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  // Subcategorías únicas
  const subcatSet = new Set<string>();
  for (const p of productos) {
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
  const marcaUrls: MetadataRoute.Sitemap = (marcasData.data ?? []).map((m) => ({
    url: `${BASE}/marcas/${m.slug}`,
    lastModified: m.updated_at ? new Date(m.updated_at) : undefined,
    changeFrequency: "monthly" as const,
    priority: 0.5,
  }));

  const staticUrls: MetadataRoute.Sitemap = [
    { url: BASE,                          changeFrequency: "monthly" as const,  priority: 1.0 },
    { url: `${BASE}/productos`,           changeFrequency: "weekly"  as const,  priority: 0.9 },
    { url: `${BASE}/marcas`,              changeFrequency: "weekly"  as const,  priority: 0.6 },
    { url: `${BASE}/profesionales`,       changeFrequency: "monthly" as const,  priority: 0.7 },
    { url: `${BASE}/blog`,                changeFrequency: "weekly"  as const,  priority: 0.8 },
    { url: `${BASE}/sobre-nosotros`,      changeFrequency: "monthly" as const,  priority: 0.4 },
    { url: `${BASE}/envios`,              changeFrequency: "monthly" as const,  priority: 0.3 },
    { url: `${BASE}/devoluciones`,        changeFrequency: "monthly" as const,  priority: 0.3 },
    { url: `${BASE}/privacidad`,          changeFrequency: "yearly"  as const,  priority: 0.2 },
    { url: `${BASE}/cookies`,             changeFrequency: "yearly"  as const,  priority: 0.2 },
    { url: `${BASE}/aviso-legal`,         changeFrequency: "yearly"  as const,  priority: 0.2 },
  ];

  // Posts del blog
  const postUrls: MetadataRoute.Sitemap = (postsData.data ?? []).map((p) => ({
    url: `${BASE}/blog/${p.slug}`,
    lastModified: p.updated_at ? new Date(p.updated_at) : undefined,
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  return [...staticUrls, ...catUrls, ...subcatUrls, ...marcaUrls, ...postUrls, ...productUrls];
}
