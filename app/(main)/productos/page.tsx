import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ProductoCard } from "@/components/producto/ProductoCard";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { slugifyCategoria, formatCategoryName } from "@/lib/seo";
import type { ProductoCatalogo } from "@/types/producto";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Productos Profesionales de Peluquería y Estética",
  description:
    "Catálogo completo de productos profesionales: tintes, champús, tratamientos, perfumería y equipos de estética. Precios especiales para profesionales.",
  alternates: {
    canonical: "https://esenciadebelleza.es/productos",
  },
  openGraph: {
    title: "Productos | Esencia de Belleza",
    description: "Catálogo completo de productos profesionales de peluquería y estética.",
    url: "https://esenciadebelleza.es/productos",
  },
};

interface CategoriaInfo {
  slug: string;
  nombre: string;
  total: number;
  imagen: string | null;
}

export default async function ProductosPage() {
  const BASE_URL = "https://esenciadebelleza.es";
  const supabase = await createClient();

  // Categorías con conteo y una imagen representativa (solo con stock)
  const { data: productosRaw } = await supabase
    .from("productos_padre")
    .select("categoria, imagen_principal_url, variaciones:productos_variaciones!inner(stock, activa)")
    .eq("activo", true)
    .eq("variaciones.activa", true)
    .gt("variaciones.stock", 0)
    .order("nombre");

  // Agrupar por categoría
  const catMap = new Map<string, { total: number; imagen: string | null }>();
  for (const p of productosRaw ?? []) {
    const entry = catMap.get(p.categoria);
    if (!entry) {
      catMap.set(p.categoria, { total: 1, imagen: p.imagen_principal_url });
    } else {
      entry.total++;
      if (!entry.imagen && p.imagen_principal_url) {
        entry.imagen = p.imagen_principal_url;
      }
    }
  }

  const categorias: CategoriaInfo[] = Array.from(catMap.entries())
    .map(([nombre, info]) => ({
      slug: slugifyCategoria(nombre),
      nombre,
      ...info,
    }))
    .sort((a, b) => b.total - a.total);

  // Destacados globales (12 productos con stock)
  const { data: destacadosRaw } = await supabase
    .from("productos_padre")
    .select(
      `id, nombre, slug, categoria, subcategoria,
       imagen_principal_url, destacado, nuevo,
       marca:marcas(nombre),
       variaciones:productos_variaciones!inner(precio_b2c, activa, stock)`
    )
    .eq("activo", true)
    .eq("destacado", true)
    .eq("variaciones.activa", true)
    .gt("variaciones.stock", 0)
    .limit(12);

  const destacados: ProductoCatalogo[] = (destacadosRaw ?? []).map((p) => {
    const vars = (p.variaciones ?? []).filter((v: { activa: boolean }) => v.activa);
    return {
      id: p.id,
      nombre: p.nombre,
      slug: p.slug,
      categoria: p.categoria,
      subcategoria: p.subcategoria,
      imagen_principal_url: p.imagen_principal_url,
      destacado: p.destacado,
      nuevo: p.nuevo,
      marca_nombre: (p.marca as unknown as { nombre: string } | null)?.nombre ?? null,
      precio_desde: vars.length > 0 ? Math.min(...vars.map((v: { precio_b2c: number }) => v.precio_b2c)) : 0,
      total_variaciones: vars.length,
    };
  });

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Inicio", item: BASE_URL },
      { "@type": "ListItem", position: 2, name: "Productos", item: `${BASE_URL}/productos` },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      <div className="container-main py-12">
        <Breadcrumb items={[{ label: "Productos" }]} className="mb-8" />

        {/* Cabecera */}
        <div className="mb-12">
          <h1
            className="text-4xl font-light text-neutral-900 mb-3"
            style={{ fontFamily: "var(--font-cormorant)" }}
          >
            Productos profesionales
          </h1>
          <div className="w-12 h-px mb-4" style={{ backgroundColor: "var(--color-oro)" }} />
          <p className="text-sm text-neutral-500 max-w-xl">
            Peluquería, estética y perfumería. Precios para particulares y{" "}
            <Link href="/profesionales" className="underline underline-offset-2">
              tarifas especiales para profesionales
            </Link>
            .
          </p>
        </div>

        {/* Categorías */}
        {categorias.length > 0 && (
          <section className="mb-16">
            <h2
              className="text-xl font-light text-neutral-700 mb-6"
              style={{ fontFamily: "var(--font-cormorant)" }}
            >
              Categorías
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {categorias.map((cat) => (
                <Link
                  key={cat.slug}
                  href={`/productos/${cat.slug}`}
                  className="group relative aspect-square bg-neutral-50 overflow-hidden block"
                >
                  {cat.imagen && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={cat.imagen}
                      alt={formatCategoryName(cat.nombre)}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 opacity-60"
                    />
                  )}
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
                    <span
                      className="text-lg font-light text-neutral-900"
                      style={{ fontFamily: "var(--font-cormorant)" }}
                    >
                      {formatCategoryName(cat.nombre)}
                    </span>
                    <span className="text-xs text-neutral-500 mt-1">
                      {cat.total} productos
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Productos destacados */}
        {destacados.length > 0 && (
          <section>
            <h2
              className="text-xl font-light text-neutral-700 mb-6"
              style={{ fontFamily: "var(--font-cormorant)" }}
            >
              Destacados
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-x-4 gap-y-10">
              {destacados.map((p, i) => (
                <ProductoCard key={p.id} producto={p} priority={i < 6} />
              ))}
            </div>
          </section>
        )}

        {categorias.length === 0 && destacados.length === 0 && (
          <p className="text-sm text-neutral-400 py-16 text-center">
            Los productos estarán disponibles próximamente.
          </p>
        )}
      </div>
    </>
  );
}
