import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { buildBreadcrumbJsonLdItems } from "@/lib/seo";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Marcas de Peluquería y Estética | Esencia de Belleza",
  description:
    "Descubre todas las marcas profesionales de peluquería, estética y perfumería disponibles en Esencia de Belleza. L'Oréal, Wella, Fanola y muchas más.",
  alternates: { canonical: "https://esenciadebelleza.es/marcas" },
};

export default async function MarcasPage() {
  const supabase = await createClient();

  const { data: marcas } = await supabase
    .from("marcas")
    .select("id, nombre, slug, logo_url")
    .eq("activa", true)
    .order("nombre");

  const breadcrumbJsonLd = buildBreadcrumbJsonLdItems([
    { name: "Inicio", url: "https://esenciadebelleza.es" },
    { name: "Marcas", url: "https://esenciadebelleza.es/marcas" },
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      <div className="container-main py-12">
        <Breadcrumb items={[{ label: "Marcas" }]} className="mb-8" />

        <div className="mb-12">
          <h1
            className="text-4xl font-light text-neutral-900 mb-3"
            style={{ fontFamily: "var(--font-cormorant)" }}
          >
            Marcas
          </h1>
          <div className="w-12 h-px mb-4" style={{ backgroundColor: "var(--color-oro)" }} />
          <p className="text-sm text-neutral-500 max-w-xl">
            Trabajamos con las mejores marcas de productos profesionales para
            peluquería, estética y perfumería.
          </p>
        </div>

        {!marcas || marcas.length === 0 ? (
          <p className="text-sm text-neutral-400">
            Próximamente disponibles todas las marcas.
          </p>
        ) : (
          <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-px bg-neutral-100">
            {marcas.map((marca) => (
              <li key={marca.id}>
                <Link
                  href={`/marcas/${marca.slug}`}
                  className="flex flex-col items-center justify-center gap-3 bg-white py-10 px-4 hover:bg-neutral-50 transition-colors group text-center"
                >
                  {marca.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={marca.logo_url}
                      alt={`Logo ${marca.nombre}`}
                      className="h-10 w-auto object-contain grayscale group-hover:grayscale-0 transition-all"
                    />
                  ) : (
                    <div
                      className="w-10 h-px"
                      style={{ backgroundColor: "var(--color-oro)" }}
                    />
                  )}
                  <span
                    className="text-xs tracking-widest uppercase text-neutral-600 group-hover:text-neutral-900 transition-colors"
                    style={{ fontFamily: "var(--font-inter)" }}
                  >
                    {marca.nombre}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
