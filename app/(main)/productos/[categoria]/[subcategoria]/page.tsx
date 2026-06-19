import { notFound } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { ProductoCard } from "@/components/producto/ProductoCard";
import { buildCategoriaMetadata, slugifyCategoria } from "@/lib/seo";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import type { Metadata } from "next";
import type { ProductoCatalogo } from "@/types/producto";

export const revalidate = 3600;

interface PageProps {
  params: Promise<{ categoria: string; subcategoria: string }>;
  searchParams: Promise<{ marca?: string; orden?: string; pagina?: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { categoria, subcategoria } = await params;
  return buildCategoriaMetadata(categoria, subcategoria);
}

export default async function SubcategoriaPage({ params, searchParams }: PageProps) {
  const { categoria, subcategoria } = await params;
  const { marca, orden = "nombre", pagina = "1" } = await searchParams;

  const PAGE_SIZE = 24;
  const page = Math.max(1, parseInt(pagina, 10));
  const from = (page - 1) * PAGE_SIZE;

  const supabase = await createClient();

  // Resolver slugs de URL a nombres reales en BD (ilike no es accent-insensitive)
  const { data: todasCats } = await supabase
    .from("productos_padre")
    .select("categoria, subcategoria")
    .eq("activo", true);
  const filas = todasCats ?? [];
  const categoriaNombre = [...new Set(filas.map((p) => p.categoria))]
    .find((c) => slugifyCategoria(c) === categoria);
  const subcategoriaNombre = [...new Set(filas.map((p) => p.subcategoria).filter(Boolean))]
    .find((s) => slugifyCategoria(s!) === subcategoria);

  if (!categoriaNombre) notFound();

  let query = supabase
    .from("productos_padre")
    .select(`
      id, nombre, slug, categoria, subcategoria,
      imagen_principal_url, destacado, nuevo,
      marca:marcas(nombre),
      variaciones:productos_variaciones!inner(precio_b2c, activa, stock)
    `, { count: "exact" })
    .eq("activo", true)
    .eq("variaciones.activa", true)
    .eq("categoria", categoriaNombre)
    .eq("subcategoria", subcategoriaNombre ?? subcategoria.replace(/-/g, " "))
    .range(from, from + PAGE_SIZE - 1);

  if (marca) query = query.eq("marca_id", marca);
  if (orden === "precio-asc") query = query.order("nombre");
  else query = query.order("nombre");

  // Marcas disponibles en esta subcategoría (para el filtro superior)
  const { data: marcasData } = await supabase
    .from("productos_padre")
    .select("marca_id, marca:marcas(id, nombre, logo_url)")
    .eq("activo", true)
    .eq("categoria", categoriaNombre)
    .eq("subcategoria", subcategoriaNombre ?? subcategoria.replace(/-/g, " "))
    .not("marca_id", "is", null);

  const marcas = Object.values(
    (marcasData ?? []).reduce((acc, p) => {
      const m = p.marca as unknown as { id: string; nombre: string; logo_url: string | null } | null;
      if (m && !acc[m.id]) acc[m.id] = { id: m.id, nombre: m.nombre, logo_url: m.logo_url };
      return acc;
    }, {} as Record<string, { id: string; nombre: string; logo_url: string | null }>)
  ).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

  const [{ data, count }] = await Promise.all([query]);

  const productos: ProductoCatalogo[] = (data ?? []).map((p) => {
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

  const totalPaginas = Math.ceil((count ?? 0) / PAGE_SIZE);
  const baseUrl = `/productos/${categoria}/${subcategoria}`;

  return (
    <div className="container-main py-8 lg:py-12">
      {/* Canonical apunta siempre a la URL sin filtros (no indexar ?marca=X) */}
      {marca && <link rel="canonical" href={`https://esenciadebelleza.es${baseUrl}`} />}

      {/* Cabecera */}
      <div className="mb-8">
        <Breadcrumb
          items={[
            { label: categoria.replace(/-/g, " "), href: `/productos/${slugifyCategoria(categoria)}` },
            { label: subcategoria.replace(/-/g, " ") },
          ]}
          className="mb-4"
        />
        <h1
          className="text-3xl lg:text-4xl font-light text-neutral-900 capitalize"
          style={{ fontFamily: "var(--font-cormorant)" }}
        >
          {subcategoriaNombre ?? subcategoria.replace(/-/g, " ")}
        </h1>
        <p className="text-sm text-neutral-400 mt-2">
          {count ?? 0} productos{marca && marcas.find(m => m.id === marca) ? ` · ${marcas.find(m => m.id === marca)!.nombre}` : ""}
        </p>
      </div>

      {/* Filtro por marcas — cards visuales con logo */}
      {marcas.length > 1 && (
        <div className="mb-10">
          <div className="flex flex-wrap gap-3">
            {/* "Todas" pill */}
            <a
              href={baseUrl}
              className={`flex items-center gap-2 px-4 py-2 border text-xs tracking-wider transition-colors ${
                !marca
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-200 text-neutral-500 hover:border-neutral-900 hover:text-neutral-900"
              }`}
            >
              Todas
            </a>

            {/* Card por marca */}
            {marcas.map((m) => {
              const activa = marca === m.id;
              return (
                <a
                  key={m.id}
                  href={`${baseUrl}?marca=${m.id}`}
                  title={m.nombre}
                  className={`flex items-center gap-2.5 px-4 py-2 border transition-colors ${
                    activa
                      ? "border-neutral-900 bg-neutral-50 shadow-sm"
                      : "border-neutral-200 hover:border-neutral-400 bg-white"
                  }`}
                >
                  {m.logo_url ? (
                    <div className="relative w-14 h-7 shrink-0">
                      <Image
                        src={m.logo_url}
                        alt={m.nombre}
                        fill
                        sizes="56px"
                        className="object-contain"
                      />
                    </div>
                  ) : null}
                  <span className={`text-xs tracking-wide whitespace-nowrap ${
                    activa ? "font-medium text-neutral-900" : "text-neutral-600"
                  }`}>
                    {m.nombre}
                  </span>
                </a>
              );
            })}
          </div>
        </div>
      )}

      {/* Grid de productos */}
      {productos.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6 lg:gap-8">
          {productos.map((p, i) => (
            <ProductoCard key={p.id} producto={p} priority={i < 4} />
          ))}
        </div>
      ) : (
        <div className="py-24 text-center text-neutral-400 text-sm">
          No hay productos en esta categoría todavía.
        </div>
      )}

      {/* Paginación */}
      {totalPaginas > 1 && (
        <div className="flex items-center justify-center gap-2 mt-16">
          {Array.from({ length: totalPaginas }, (_, i) => i + 1).map((p) => (
            <a
              key={p}
              href={`?pagina=${p}`}
              className={`w-9 h-9 flex items-center justify-center text-sm border transition-colors ${
                p === page
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-200 hover:border-neutral-900"
              }`}
            >
              {p}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
