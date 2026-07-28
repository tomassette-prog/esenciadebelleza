import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { ProductoCard } from "@/components/producto/ProductoCard";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import type { ProductoCatalogo } from "@/types/producto";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ q?: string; cat?: string; subcat?: string; pagina?: string }>;
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

type CatCount = { categoria: string; subcategoria: string | null; count: number };

type SupabaseQuery = ReturnType<ReturnType<typeof import("@supabase/supabase-js").createClient>["from"]>;

function buildSearchQuery(
  baseQuery: SupabaseQuery,
  words: string[]
) {
  if (words.length === 0) return baseQuery;
  const orClause = words.map((w) => `nombre.ilike.%${w}%`).join(",");
  return baseQuery.or(orClause);
}

export default async function BuscarPage({ searchParams }: PageProps) {
  const { q = "", cat = "", subcat = "", pagina = "1" } = await searchParams;
  const query = q.trim();
  const page  = Math.max(1, parseInt(pagina, 10));
  const from  = (page - 1) * PAGE_SIZE;

  const words = query.length >= 2
    ? query.split(/\s+/).filter((w) => w.length >= 2)
    : [];

  let productos: ProductoCatalogo[] = [];
  let total = 0;
  let catCounts: CatCount[] = [];

  if (words.length > 0) {
    const supabase = createAdminClient();

    // Query para distribución de categorías (sin paginación, solo cat+subcat)
    let catQuery = supabase
      .from("productos_padre")
      .select("categoria, subcategoria")
      .eq("activo", true);
    catQuery = buildSearchQuery(catQuery, words);
    const { data: catData } = await catQuery;

    // Contar por categoria + subcategoria
    const countMap = new Map<string, number>();
    for (const p of (catData ?? []) as { categoria: string; subcategoria: string | null }[]) {
      const key = `${p.categoria}|||${p.subcategoria ?? ""}`;
      countMap.set(key, (countMap.get(key) ?? 0) + 1);
    }
    catCounts = [...countMap.entries()]
      .map(([key, count]) => {
        const [categoria, subcategoriaRaw] = key.split("|||");
        return { categoria, subcategoria: subcategoriaRaw || null, count };
      })
      .sort((a, b) => b.count - a.count);

    // Query principal con filtros de cat/subcat + paginación
    let mainQuery = supabase
      .from("productos_padre")
      .select(
        `id, nombre, slug, categoria, subcategoria, oferta,
         imagen_principal_url, destacado, nuevo,
         marca:marcas(nombre),
         variaciones:productos_variaciones(precio_b2c, precio_comparar, activa, stock)`,
        { count: "exact" }
      )
      .eq("activo", true);

    mainQuery = buildSearchQuery(mainQuery, words);
    if (cat) mainQuery = mainQuery.eq("categoria", cat);
    if (subcat) mainQuery = mainQuery.eq("subcategoria", subcat);
    mainQuery = mainQuery.order("nombre").range(from, from + PAGE_SIZE - 1);

    const { data, count } = await mainQuery;
    total = count ?? 0;

    productos = (data ?? []).map((p) => {
      const variacionesActivas = (p.variaciones ?? []).filter((v: { activa: boolean }) => v.activa);
      const precioDesde = variacionesActivas.length > 0
        ? Math.min(...variacionesActivas.map((v: { precio_b2c: number }) => v.precio_b2c))
        : 0;
      const precioCompararDesde = variacionesActivas
        .map((v: { precio_comparar: number | null }) => v.precio_comparar)
        .filter((pc): pc is number => pc != null && pc > 0);
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
        precio_comparar_desde: precioCompararDesde.length > 0 ? Math.min(...precioCompararDesde) : null,
        oferta: p.oferta ?? false,
        total_variaciones: variacionesActivas.length,
      };
    });
  }

  const totalPaginas = Math.ceil(total / PAGE_SIZE);

  // Categorías únicas para los filtros laterales
  const categorias = [...new Set(catCounts.map((c) => c.categoria))];
  const subcategorias = cat
    ? catCounts.filter((c) => c.categoria === cat && c.subcategoria)
    : [];

  function paginaUrl(p: number) {
    const params = new URLSearchParams({ q: query, pagina: String(p) });
    if (cat) params.set("cat", cat);
    if (subcat) params.set("subcat", subcat);
    return `/buscar?${params.toString()}`;
  }

  function catUrl(newCat: string, newSubcat = "") {
    const params = new URLSearchParams({ q: query });
    if (newCat) params.set("cat", newCat);
    if (newSubcat) params.set("subcat", newSubcat);
    return `/buscar?${params.toString()}`;
  }

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
      {words.length === 0 && (
        <p className="text-sm text-neutral-400 text-center py-16">
          Introduce al menos 2 caracteres para buscar en el catálogo.
        </p>
      )}

      {/* Sin resultados */}
      {words.length > 0 && productos.length === 0 && (
        <div className="text-center py-16">
          <p className="text-neutral-500 text-sm mb-2">
            No hemos encontrado resultados para <strong>&quot;{query}&quot;</strong>.
          </p>
          <p className="text-neutral-400 text-xs">
            Prueba con otro término o navega por{" "}
            <a href="/productos" className="underline hover:text-neutral-700">el catálogo completo</a>.
          </p>
        </div>
      )}

      {/* Resultados */}
      {productos.length > 0 && (
        <div className="flex gap-8 items-start">
          {/* Sidebar filtros */}
          {categorias.length > 1 && (
            <aside className="hidden lg:block w-48 shrink-0 space-y-5">
              <div>
                <p className="text-xs font-medium uppercase tracking-widest text-neutral-500 mb-3">Categoría</p>
                <ul className="space-y-1">
                  <li>
                    <a
                      href={catUrl("")}
                      className={`text-sm transition-colors block py-0.5 ${!cat ? "font-semibold text-neutral-900" : "text-neutral-500 hover:text-neutral-900"}`}
                    >
                      Todas <span className="text-neutral-400 text-xs">({catCounts.reduce((a, c) => a + c.count, 0)})</span>
                    </a>
                  </li>
                  {categorias.map((c) => {
                    const count = catCounts.filter((x) => x.categoria === c).reduce((a, x) => a + x.count, 0);
                    return (
                      <li key={c}>
                        <a
                          href={catUrl(c)}
                          className={`text-sm transition-colors block py-0.5 capitalize ${cat === c ? "font-semibold text-neutral-900" : "text-neutral-500 hover:text-neutral-900"}`}
                        >
                          {c} <span className="text-neutral-400 text-xs">({count})</span>
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </div>

              {subcategorias.length > 0 && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-widest text-neutral-500 mb-3">Subcategoría</p>
                  <ul className="space-y-1">
                    <li>
                      <a
                        href={catUrl(cat)}
                        className={`text-sm transition-colors block py-0.5 ${!subcat ? "font-semibold text-neutral-900" : "text-neutral-500 hover:text-neutral-900"}`}
                      >
                        Todas
                      </a>
                    </li>
                    {subcategorias.map(({ subcategoria: s, count }) => (
                      <li key={s}>
                        <a
                          href={catUrl(cat, s!)}
                          className={`text-sm transition-colors block py-0.5 capitalize ${subcat === s ? "font-semibold text-neutral-900" : "text-neutral-500 hover:text-neutral-900"}`}
                        >
                          {s} <span className="text-neutral-400 text-xs">({count})</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </aside>
          )}

          <div className="flex-1 min-w-0">
            {/* Filtros mobile + header */}
            <div className="flex flex-wrap items-center gap-2 mb-6">
              <p className="text-sm text-neutral-500 mr-auto">
                <span className="font-medium text-neutral-900">{total}</span> resultado{total !== 1 ? "s" : ""} para{" "}
                <span className="font-medium">&quot;{query}&quot;</span>
                {cat && <span className="text-neutral-400"> · {cat}{subcat ? ` / ${subcat}` : ""}</span>}
              </p>

              {/* Chips mobile para categorías */}
              {categorias.length > 1 && (
                <div className="flex flex-wrap gap-1.5 lg:hidden w-full">
                  <a
                    href={catUrl("")}
                    className={`px-3 py-1 text-xs border transition-colors ${!cat ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 text-neutral-600 hover:border-neutral-500"}`}
                  >
                    Todas
                  </a>
                  {categorias.map((c) => (
                    <a
                      key={c}
                      href={catUrl(c)}
                      className={`px-3 py-1 text-xs border capitalize transition-colors ${cat === c ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 text-neutral-600 hover:border-neutral-500"}`}
                    >
                      {c}
                    </a>
                  ))}
                </div>
              )}

              {/* Chips mobile subcategorías */}
              {subcategorias.length > 0 && (
                <div className="flex flex-wrap gap-1.5 lg:hidden w-full">
                  {subcategorias.map(({ subcategoria: s }) => (
                    <a
                      key={s}
                      href={catUrl(cat, s!)}
                      className={`px-3 py-1 text-xs border capitalize transition-colors ${subcat === s ? "border-[#C4857A] bg-[#C4857A] text-white" : "border-neutral-200 text-neutral-600 hover:border-neutral-500"}`}
                    >
                      {s}
                    </a>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-6 lg:gap-8">
              {productos.map((p, i) => (
                <ProductoCard key={p.id} producto={p} priority={i < 4} />
              ))}
            </div>

            {/* Paginación */}
            {totalPaginas > 1 && (
              <div className="flex items-center justify-center gap-2 mt-14">
                {page > 1 && (
                  <a href={paginaUrl(page - 1)} className="w-9 h-9 flex items-center justify-center text-sm border border-neutral-200 hover:border-neutral-900 transition-colors">←</a>
                )}
                {Array.from({ length: totalPaginas }, (_, i) => i + 1)
                  .filter((p) => Math.abs(p - page) <= 2)
                  .map((p) => (
                    <a
                      key={p}
                      href={paginaUrl(p)}
                      className={`w-9 h-9 flex items-center justify-center text-sm border transition-colors ${p === page ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 hover:border-neutral-900"}`}
                    >
                      {p}
                    </a>
                  ))}
                {page < totalPaginas && (
                  <a href={paginaUrl(page + 1)} className="w-9 h-9 flex items-center justify-center text-sm border border-neutral-200 hover:border-neutral-900 transition-colors">→</a>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
