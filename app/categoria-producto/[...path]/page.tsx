/**
 * app/categoria-producto/[...path]/page.tsx
 *
 * Redirige 301 las URLs antiguas de WooCommerce:
 *   /categoria-producto/peluqueria/          →  /productos/peluqueria
 *   /categoria-producto/peluqueria/tintes/   →  /productos/peluqueria/tintes
 *
 * También cubre variantes comunes:
 *   /product-category/[...path]
 *   /categoria/[...path]
 *   /category/[...path]
 */
import { redirect } from "next/navigation";

export default async function LegacyCategoriaPage({
  params,
}: {
  params: Promise<{ path: string[] }>;
}) {
  const { path } = await params;

  // Tomar solo los primeros 2 segmentos (categoria/subcategoria)
  const [cat, subcat] = path;

  if (cat && subcat) {
    redirect(`/productos/${cat}/${subcat}`);
  } else if (cat) {
    redirect(`/productos/${cat}`);
  }

  redirect("/productos");
}
