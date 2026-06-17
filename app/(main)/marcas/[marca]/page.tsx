import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { buildBreadcrumbJsonLdItems, buildBreadcrumbJsonLd, slugifyCategoria, formatPrice } from "@/lib/seo";

export const revalidate = 3600;

interface PageProps {
  params: Promise<{ marca: string }>;
}

export async function generateStaticParams() {
  const supabase = createAdminClient();
  const { data } = await supabase.from("marcas").select("slug");
  return (data ?? []).map((m) => ({ marca: m.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { marca: marcaSlug } = await params;
  const supabase = await createClient();

  const { data: marca } = await supabase
    .from("marcas")
    .select("nombre, descripcion")
    .eq("slug", marcaSlug)
    .single();

  if (!marca) return {};

  const title = `${marca.nombre} | Productos Profesionales | Esencia de Belleza`;
  const description =
    marca.descripcion ??
    `Compra productos profesionales de ${marca.nombre} en Esencia de Belleza. Envío rápido en España. Precios para particulares y profesionales.`;

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
  const supabase = await createClient();

  const { data: marca } = await supabase
    .from("marcas")
    .select("id, nombre, slug, logo_url, descripcion")
    .eq("slug", marcaSlug)
    .single();

  if (!marca) notFound();

  const { data: productos } = await supabase
    .from("productos_padre")
    .select(`
      id, nombre, slug, categoria, subcategoria, imagen_principal_url, seo_description,
      productos_variaciones ( precio_b2c )
    `)
    .eq("marca_id", marca.id)
    .eq("activo", true)
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
            {marca.descripcion && (
              <p className="text-sm text-neutral-500 max-w-xl">{marca.descripcion}</p>
            )}
          </div>
          <span className="ml-auto text-xs text-neutral-400 shrink-0">
            {productos?.length ?? 0} productos
          </span>
        </div>

        {/* Grid de productos */}
        {!productos || productos.length === 0 ? (
          <p className="text-sm text-neutral-400">
            No hay productos disponibles de esta marca aún.
          </p>
        ) : (
          <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-px bg-neutral-100">
            {productos.map((p) => {
              const precios = (p.productos_variaciones as { precio_b2c: number }[] ?? []).map(
                (v) => v.precio_b2c
              );
              const precioDesde = precios.length > 0 ? Math.min(...precios) : null;
              const href = `/productos/${slugifyCategoria(p.categoria)}/${slugifyCategoria(p.subcategoria ?? "general")}/${p.slug}`;

              return (
                <li key={p.id}>
                  <Link
                    href={href}
                    className="flex flex-col bg-white hover:bg-neutral-50 transition-colors group"
                  >
                    {/* Imagen */}
                    <div className="aspect-square overflow-hidden bg-neutral-50">
                      {p.imagen_principal_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.imagen_principal_url}
                          alt={p.nombre}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <div className="w-8 h-px" style={{ backgroundColor: "var(--color-oro)" }} />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="p-4">
                      <p
                        className="text-sm font-light text-neutral-900 leading-snug mb-2 line-clamp-2"
                        style={{ fontFamily: "var(--font-cormorant)", fontSize: "1rem" }}
                      >
                        {p.nombre}
                      </p>
                      {precioDesde && (
                        <p className="text-xs text-neutral-500">
                          Desde <span className="text-neutral-900 font-medium">{formatPrice(precioDesde)}</span>
                        </p>
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
