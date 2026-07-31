import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { buildBreadcrumbJsonLdItems, buildBreadcrumbJsonLd, slugifyCategoria, formatPrice } from "@/lib/seo";
import { MarcaProductosClient } from "@/components/marcas/MarcaProductosClient";

export const revalidate = 0;          // sin caché — siempre SSR
export const dynamic = "force-dynamic"; // nunca estático
export const dynamicParams = true;

interface PageProps {
  params: Promise<{ marca: string }>;
}

// Sin generateStaticParams — SSR puro para evitar 404 por slugs no pre-generados en build

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { marca: marcaSlug } = await params;
  const supabase = createAdminClient();

  const { data: marca } = await supabase
    .from("marcas")
    .select("nombre")
    .eq("slug", marcaSlug)
    .single();

  if (!marca) return {};

  const title = `${marca.nombre} | Productos Profesionales | Esencia de Belleza`;
  const description = `Compra productos profesionales de ${marca.nombre} en Esencia de Belleza. Envío rápido en España. Precios para particulares y profesionales.`;

  return {
    title: title.slice(0, 60),
    description: description.slice(0, 155),
    alternates: { canonical: `https://esenciadebelleza.es/marcas/${marcaSlug}` },
    openGraph: {
      title,
      description,
      url: `https://esenciadebelleza.es/marcas/${marcaSlug}`,
      locale: "es_ES",
    },
  };
}

export default async function MarcaPage({ params }: PageProps) {
  const { marca: marcaSlug } = await params;

  let supabase;
  try {
    supabase = createAdminClient();
  } catch (e) {
    // Si falla createAdminClient (env vars), mostrar página de error descriptiva
    return (
      <main className="container-main py-20 text-center">
        <h1 className="text-2xl text-neutral-700 mb-4">Error de configuración</h1>
        <p className="text-neutral-500">No se pudo conectar con la base de datos. Contacte con el administrador.</p>
      </main>
    );
  }

  const { data: marca, error } = await supabase
    .from("marcas")
    .select("id, nombre, slug, logo_url")
    .eq("slug", marcaSlug)
    .maybeSingle();

  // Si hay error de Supabase, mostrar info de debug en lugar de 404
  if (error) {
    return (
      <main className="container-main py-20 text-center">
        <h1 className="text-2xl text-neutral-700 mb-4">Error al cargar la marca</h1>
        <p className="text-neutral-500 mb-2">Slug: <code>{marcaSlug}</code></p>
        <p className="text-red-500 text-sm">{error.message}</p>
      </main>
    );
  }

  if (!marca) notFound();

  const { data: productos } = await supabase
    .from("productos_padre")
    .select(`
      id, nombre, slug, categoria, subcategoria, imagen_principal_url, seo_description,
      productos_variaciones!inner ( precio_b2c, activa )
    `)
    .eq("marca_id", marca.id)
    .eq("activo", true)
    .eq("productos_variaciones.activa", true)
    .order("nombre");

  const breadcrumbJsonLd = buildBreadcrumbJsonLdItems([
    { name: "Inicio", url: "https://esenciadebelleza.es" },
    { name: "Marcas", url: "https://esenciadebelleza.es/marcas" },
    { name: marca.nombre, url: `https://esenciadebelleza.es/marcas/${marcaSlug}` },
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      <div className="container-main py-12">
        <Breadcrumb
          items={[
            { label: "Marcas", href: "/marcas" },
            { label: marca.nombre },
          ]}
          className="mb-8"
        />

        {/* Cabecera de marca */}
        <div className="flex items-end gap-6 mb-12 pb-8 border-b border-neutral-100">
          {marca.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={marca.logo_url}
              alt={`Logo ${marca.nombre}`}
              className="h-14 w-auto object-contain"
            />
          )}
          <div>
            <h1
              className="text-4xl font-light text-neutral-900 mb-2"
              style={{ fontFamily: "var(--font-cormorant)" }}
            >
              {marca.nombre}
            </h1>
            <div className="w-12 h-px mb-3" style={{ backgroundColor: "var(--color-oro)" }} />
          </div>
          <span className="ml-auto text-xs text-neutral-400 shrink-0">
            {productos?.length ?? 0} productos
          </span>
        </div>

        {/* Productos con filtros dinámicos */}
        {!productos || productos.length === 0 ? (
          <p className="text-sm text-neutral-400">
            No hay productos disponibles de esta marca aún.
          </p>
        ) : (
          <MarcaProductosClient productos={productos} marcaNombre={marca.nombre} />
        )}
      </div>
    </>
  );
}
