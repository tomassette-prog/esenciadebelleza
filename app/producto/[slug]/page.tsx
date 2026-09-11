/**
 * app/producto/[slug]/page.tsx
 *
 * Redirige 301 las URLs antiguas de WooCommerce:
 *   /producto/[slug]  →  /productos/[categoria]/[subcategoria]/[slug]
 *
 * Si el producto no existe, devuelve 404 (no redirect a búsqueda,
 * para que Google desindexe la URL rota)
 */
import { redirect, notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { slugifyCategoria } from "@/lib/seo";

export default async function LegacyProductoPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = createAdminClient();

  const { data: producto } = await supabase
    .from("productos_padre")
    .select("slug, categoria, subcategoria")
    .eq("slug", slug)
    .single();

  if (producto) {
    redirect(
      `/productos/${slugifyCategoria(producto.categoria)}/${slugifyCategoria(producto.subcategoria ?? "general")}/${producto.slug}`
    );
  }

  // Producto no existe → 404 real para que Google desindexe
  notFound();
}
