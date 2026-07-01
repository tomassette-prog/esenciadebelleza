import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { ProductoCard } from "@/components/producto/ProductoCard";
import { slugifyCategoria } from "@/lib/seo";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import type { ProductoCatalogo } from "@/types/producto";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ q?: string; pagina?: string }>;
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const { q } = await searchParams;
  return {
    title: q ? `Resultados para "${q}" | Esencia de Belleza` : "Buscador | Esencia de Belleza",
    description: "Busca entre más de 3000 productos profesionales de peluquería, estética y barbería.",
    robots: { index: false, follow: true },
  };
}

const PAGE_SIZE = 24;

export default async function BuscarPage({ searchParams }: PageProps) {
  const { q = "", pagina = "1" } = await searchParams;
  const query = q.trim();
  const page  = Math.max(1, parseInt(pagina, 10));
  const from  = (page - 1) * PAGE_SIZE;

  let productos: ProductoCatalogo[] = [];
  let total = 0;

  if (query.length >= 2) {
    const supabase = createAdminClient();

    const { data, count } = await supabase
      .from("productos_padre")
      .select(`
        id, nombre, slug, categoria, subcategoria,
        imagen_principal_url, destacado, nuevo,
        marca:marcas(nombre),
        variaciones:productos_variaciones(precio_b2c, activa, stock)
      `, { count: "exact" })
      .eq("activo", true)
      .eq("variaciones.activa", true)
      .ilike("nombre", `%${query}%`)
      .order("nombre")
      .range(from, from + PAGE_SIZE - 1);

    total = count ?? 0;

    productos = (data ?? []).map((p) => {
      const variacionesActivas = (p.variaciones ?? []).filter((v: { activa: boolean }) => v.activa);
      const precioDesde = variacionesActivas.length > 0
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
  }

  const totalPaginas = Math.ceil(total / PAGE_SIZE);

  return (
    <main className="container-main py-10 lg:py-14">
      <Breadcrumb items={[{ label: "Buscar" }]} className="mb-6" />

      {/* Buscador */}
      <form method="GET" action="/buscar" className="mb-10">
        <div className="flex items-center gap-0 max-w-2xl">
          <input
            type="search"
            name="q"
            defaultValue={query}
            autoFocus
            placeholder="Busca un producto, marca o tratamiento..."
            className="flex-1 border border-neutral-300 border-r-0 px-4 py-3 text-sm focus:outline-none focus:border-neutral-900 transition-colors"
          />
          <button
            type="submit"
            className="px-5 py-3 bg-neutral-900 text-white hover:bg-neutral-700 transition-colors shrink-0"
            aria-label="Buscar"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
          </button>
        </div>
      </form>

      {/* Sin búsqueda aún */}
      {!query && (
        <p className="text-sm text-neutral-400 text-center py-16">
          Introduce al menos 2 caracteres para buscar en el catálogo.
        </p>
      )}

      {/* Búsqueda sin resultados */}
      {query.length >= 2 && productos.length === 0 && (
        <div className="text-center py-16">
          <p className="text-neutral-500 text-sm mb-2">
            No hemos encontrado resultados para <strong>&quot;{query}&quot;</strong>.
          </p>
          <p className="text-neutral-400 text-xs">
            Prueba con otro término o navega por{" "}
            <a href="/productos" className="underline hover:text-neutral-700">
              el catálogo completo
            </a>.
          </p>
        </div>
      )}

      {/* Resultados */}
      {productos.length > 0 && (
        <>
          <p className="text-sm text-neutral-500 mb-6">
            <span className="font-medium text-neutral-900">{total}</span> resultado{total !== 1 ? "s" : ""} para{" "}
            <span className="font-medium">&quot;{query}&quot;</span>
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6 lg:gap-8">
            {productos.map((p, i) => (
              <ProductoCard key={p.id} producto={p} priority={i < 4} />
            ))}
          </div>

          {/* Paginación */}
          {totalPaginas > 1 && (
            <div className="flex items-center justify-center gap-2 mt-14">
              {page > 1 && (
                <a
                  href={`/buscar?q=${encodeURIComponent(query)}&pagina=${page - 1}`}
                  className="w-9 h-9 flex items-center justify-center text-sm border border-neutral-200 hover:border-neutral-900 transition-colors"
                >
                  ←
                </a>
              )}
              {Array.from({ length: totalPaginas }, (_, i) => i + 1)
                .filter((p) => Math.abs(p - page) <= 2)
                .map((p) => (
                  <a
                    key={p}
                    href={`/buscar?q=${encodeURIComponent(query)}&pagina=${p}`}
                    className={`w-9 h-9 flex items-center justify-center text-sm border transition-colors ${
                      p === page
                        ? "border-neutral-900 bg-neutral-900 text-white"
                        : "border-neutral-200 hover:border-neutral-900"
                    }`}
                  >
                    {p}
                  </a>
                ))}
              {page < totalPaginas && (
                <a
                  href={`/buscar?q=${encodeURIComponent(query)}&pagina=${page + 1}`}
                  className="w-9 h-9 flex items-center justify-center text-sm border border-neutral-200 hover:border-neutral-900 transition-colors"
                >
                  →
                </a>
              )}
            </div>
          )}
        </>
      )}
    </main>
  );
}
