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

  let query = supabase
    .from("productos_padre")
    .select(`
      id, nombre, slug, categoria, subcategoria,
      imagen_principal_url, destacado, nuevo,
      marca:marcas(nombre),
      variaciones:productos_variaciones(precio_b2c, activa)
    `, { count: "exact" })
    .eq("activo", true)
    .ilike("categoria", categoria.replace(/-/g, " "))
    .ilike("subcategoria", subcategoria.replace(/-/g, " "))
    .range(from, from + PAGE_SIZE - 1);

  if (marca) query = query.eq("marca_id", marca);
  if (orden === "precio-asc") query = query.order("nombre"); // precio real en variaciones
  else query = query.order("nombre");

  const { data, count } = await query;

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

  return (
    <div className="container-main py-8 lg:py-12">
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
          {subcategoria.replace(/-/g, " ")}
        </h1>
        <p className="text-sm text-neutral-400 mt-2">
          {count ?? 0} productos
        </p>
      </div>

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
