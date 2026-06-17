import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ProductoCard } from "@/components/producto/ProductoCard";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import {
  buildCategoriaMetadata,
  buildBreadcrumbJsonLd,
  slugifyCategoria,
  formatCategoryName,
} from "@/lib/seo";
import type { ProductoCatalogo } from "@/types/producto";
import Link from "next/link";

export const revalidate = 3600;

interface PageProps {
  params: Promise<{ categoria: string }>;
  searchParams: Promise<{ orden?: string; pagina?: string }>;
}

// ─── generateStaticParams: pre-renderizar todas las categorías ────────────────
export async function generateStaticParams() {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("productos_padre")
    .select("categoria")
    .eq("activo", true);

  const categorias = [...new Set((data ?? []).map((p) => p.categoria))];
  return categorias.map((cat) => ({ categoria: slugifyCategoria(cat) }));
}

// ─── generateMetadata ─────────────────────────────────────────────────────────
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { categoria } = await params;
  return buildCategoriaMetadata(categoria);
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default async function CategoriaPage({ params, searchParams }: PageProps) {
  const { categoria } = await params;
  const { orden = "nombre", pagina = "1" } = await searchParams;

  const BASE_URL = "https://esenciadebelleza.es";
  const PAGE_SIZE = 24;
  const page = Math.max(1, parseInt(pagina, 10));
  const from = (page - 1) * PAGE_SIZE;

  const supabase = await createClient();

  // Obtener subcategorías únicas dentro de esta categoría
  const { data: subcatData } = await supabase
    .from("productos_padre")
    .select("subcategoria")
    .eq("activo", true)
    .ilike("categoria", categoria.replace(/-/g, " "));

  const subcategorias = [
    ...new Set((subcatData ?? []).map((p) => p.subcategoria).filter(Boolean)),
  ] as string[];

  if (subcatData === null || subcatData.length === 0) notFound();

  // Obtener productos de la categoría (solo con stock > 0)
  let query = supabase
    .from("productos_padre")
    .select(
      `id, nombre, slug, categoria, subcategoria,
       imagen_principal_url, destacado, nuevo,
       marca:marcas(nombre),
       variaciones:productos_variaciones!inner(precio_b2c, activa, stock)`,
      { count: "exact" }
    )
    .eq("activo", true)
    .eq("variaciones.activa", true)
    .gt("variaciones.stock", 0)
    .ilike("categoria", categoria.replace(/-/g, " "))
    .range(from, from + PAGE_SIZE - 1);

  if (orden === "precio-asc") query = query.order("nombre");
  else query = query.order("nombre");

  const { data, count } = await query;

  const productos: ProductoCatalogo[] = (data ?? []).map((p) => {
    const variacionesActivas = (p.variaciones ?? []).filter(
      (v: { activa: boolean }) => v.activa
    );
    const precioDesde =
      variacionesActivas.length > 0
        ? Math.min(...variacionesActivas.map((v: { precio_b2c: number }) => v.precio_b2c))
        : 0;
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
      precio_desde: precioDesde,
      total_variaciones: variacionesActivas.length,
    };
  });

  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE);
  const categoriaNombre = formatCategoryName(categoria);
  const canonicalUrl = `${BASE_URL}/productos/${categoria}`;

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Inicio", item: BASE_URL },
      { "@type": "ListItem", position: 2, name: categoriaNombre, item: canonicalUrl },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <link rel="canonical" href={page === 1 ? canonicalUrl : `${canonicalUrl}?pagina=${page}`} />

      <div className="container-main py-12">
        <Breadcrumb
          items={[{ label: categoriaNombre }]}
          className="mb-8"
        />

        {/* Cabecera */}
        <div className="mb-10">
          <h1
            className="text-4xl font-light text-neutral-900 mb-3"
            style={{ fontFamily: "var(--font-cormorant)" }}
          >
            {categoriaNombre}
          </h1>
          <div
            className="w-12 h-px mb-4"
            style={{ backgroundColor: "var(--color-oro)" }}
          />
          <p className="text-sm text-neutral-500">
            {count ?? 0} productos disponibles
          </p>
        </div>

        {/* Filtro de subcategorías */}
        {subcategorias.length > 1 && (
          <div className="flex flex-wrap gap-2 mb-8">
            <Link
              href={`/productos/${categoria}`}
              className="px-4 py-2 text-xs tracking-widest uppercase border border-neutral-300 hover:border-neutral-800 transition-colors"
            >
              Todos
            </Link>
            {subcategorias.map((sub) => (
              <Link
                key={sub}
                href={`/productos/${categoria}/${slugifyCategoria(sub)}`}
                className="px-4 py-2 text-xs tracking-widest uppercase border border-neutral-300 hover:border-neutral-800 transition-colors"
              >
                {formatCategoryName(sub)}
              </Link>
            ))}
          </div>
        )}

        {/* Grid de productos */}
        {productos.length === 0 ? (
          <p className="text-sm text-neutral-400 py-16 text-center">
            No hay productos en esta categoría todavía.
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-4 gap-y-10">
            {productos.map((p, i) => (
              <ProductoCard key={p.id} producto={p} priority={i < 5} />
            ))}
          </div>
        )}

        {/* Paginación */}
        {totalPages > 1 && (
          <nav
            className="flex justify-center gap-2 mt-16"
            aria-label="Paginación"
          >
            {page > 1 && (
              <Link
                href={`/productos/${categoria}?pagina=${page - 1}`}
                className="px-4 py-2 text-sm border border-neutral-200 hover:border-neutral-800 transition-colors"
              >
                ← Anterior
              </Link>
            )}
            <span className="px-4 py-2 text-sm text-neutral-500">
              {page} / {totalPages}
            </span>
            {page < totalPages && (
              <Link
                href={`/productos/${categoria}?pagina=${page + 1}`}
                className="px-4 py-2 text-sm border border-neutral-200 hover:border-neutral-800 transition-colors"
              >
                Siguiente →
              </Link>
            )}
          </nav>
        )}
      </div>
    </>
  );
}
