import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { ProductoCard } from "@/components/producto/ProductoCard";
import type { ProductoCatalogo } from "@/types/producto";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ cat?: string }>;
}): Promise<Metadata> {
  const { cat } = await searchParams;
  const title = cat ? `Ofertas en ${cat}` : "Ofertas";
  const description = cat
    ? `Descuentos en productos de ${cat}. Marcas profesionales de peluquería, estética y perfumería.`
    : "Productos en oferta con los mejores precios. Descuentos en marcas profesionales de peluquería, estética y perfumería.";
  return {
    title,
    description,
    alternates: { canonical: `https://esenciadebelleza.es/ofertas${cat ? `?cat=${encodeURIComponent(cat)}` : ""}` },
  };
}

function toProductoCatalogo(p: any): ProductoCatalogo {
  const variaciones = (p.variaciones ?? []).filter((v: any) => v.activa);
  const precio_desde = Math.min(...variaciones.map((v: any) => v.precio_b2c).filter((x: any) => x > 0), Infinity);
  const precioCompararDesde = variaciones
    .map((v: any) => v.precio_comparar)
    .filter((pc: any) => pc != null && pc > 0);
  return {
    id: p.id,
    nombre: p.nombre,
    slug: p.slug,
    categoria: p.categoria,
    subcategoria: p.subcategoria,
    imagen_principal_url: p.imagen_principal_url,
    destacado: p.destacado,
    nuevo: p.nuevo,
    marca_nombre: p.marca?.nombre ?? null,
    precio_desde: precio_desde === Infinity ? 0 : precio_desde,
    precio_comparar_desde: precioCompararDesde.length > 0 ? Math.min(...precioCompararDesde) : null,
    oferta: p.oferta ?? false,
    total_variaciones: variaciones.length,
  };
}

export default async function OfertasPage({
  searchParams,
}: {
  searchParams: Promise<{ cat?: string; subcat?: string }>;
}) {
  const { cat, subcat } = await searchParams;
  const supabase = createAdminClient();

  let query = supabase
    .from("productos_padre")
    .select(
      `id, nombre, slug, categoria, subcategoria,
       imagen_principal_url, destacado, nuevo,
       marca:marcas(nombre),
       variaciones:productos_variaciones!inner(precio_b2c, precio_comparar, activa, stock)`
    )
    .eq("activo", true)
    .eq("oferta", true)
    .eq("variaciones.activa", true)
    .order("nombre")
    .range(0, 999);

  if (cat) query = query.eq("categoria", cat);
  if (subcat) query = query.eq("subcategoria", subcat);

  const { data: ofertasRaw } = await query;

  const ofertas: ProductoCatalogo[] = (ofertasRaw ?? []).map(toProductoCatalogo);

  // Extraer categorías y subcategorías disponibles en ofertas
  const categoriasDisponibles = [...new Set(ofertas.map((p) => p.categoria).filter((c): c is string => !!c))].sort();
  const subcategoriasDisponibles = cat
    ? [...new Set(ofertas.filter((p) => p.categoria === cat).map((p) => p.subcategoria).filter((s): s is string => !!s))].sort()
    : [];

  return (
    <div className="container-main py-8">
      {/* Header */}
      <div className="mb-8">
        <h1
          className="text-3xl md:text-4xl font-light text-neutral-900"
          style={{ fontFamily: "var(--font-cormorant)" }}
        >
          Ofertas{cat ? ` en ${cat}` : ""}
        </h1>
        <p className="text-neutral-500 mt-2 text-sm">
          Aprovecha nuestros descuentos en productos profesionales.
          {ofertas.length > 0 && ` ${ofertas.length} productos en oferta.`}
        </p>
      </div>

      {/* Breadcrumb */}
      <nav className="text-xs text-neutral-400 mb-6">
        <Link href="/" className="hover:text-neutral-600">Inicio</Link>
        <span className="mx-2">/</span>
        {cat ? (
          <>
            <Link href="/ofertas" className="hover:text-neutral-600">Ofertas</Link>
            <span className="mx-2">/</span>
            <span className="text-neutral-600">{cat}</span>
          </>
        ) : (
          <span className="text-neutral-600">Ofertas</span>
        )}
      </nav>

      {/* Filtros de categoría */}
      {categoriasDisponibles.length > 1 && (
        <div className="mb-6 space-y-3">
          <div className="flex flex-wrap gap-2">
            <Link
              href="/ofertas"
              className={`px-3 py-1.5 text-xs border transition-colors ${!cat ? "bg-[#3D2018] text-white border-[#3D2018]" : "border-neutral-300 text-neutral-600 hover:border-neutral-500"}`}
            >
              Todas
            </Link>
            {categoriasDisponibles.map((c) => (
              <Link
                key={c}
                href={`/ofertas?cat=${encodeURIComponent(c)}`}
                className={`px-3 py-1.5 text-xs border transition-colors ${cat === c ? "bg-[#3D2018] text-white border-[#3D2018]" : "border-neutral-300 text-neutral-600 hover:border-neutral-500"}`}
              >
                {c}
              </Link>
            ))}
          </div>

          {/* Subcategorías — aparecen solo cuando hay categoría seleccionada */}
          {subcategoriasDisponibles.length > 1 && (
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/ofertas?cat=${encodeURIComponent(cat!)}`}
                className={`px-3 py-1.5 text-xs border transition-colors ${!subcat ? "bg-[#C4857A] text-white border-[#C4857A]" : "border-neutral-300 text-neutral-600 hover:border-neutral-500"}`}
              >
                Todas las subcategorías
              </Link>
              {subcategoriasDisponibles.map((s) => (
                <Link
                  key={s}
                  href={`/ofertas?cat=${encodeURIComponent(cat!)}&subcat=${encodeURIComponent(s)}`}
                  className={`px-3 py-1.5 text-xs border transition-colors ${subcat === s ? "bg-[#C4857A] text-white border-[#C4857A]" : "border-neutral-300 text-neutral-600 hover:border-neutral-500"}`}
                >
                  {s}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Grid */}
      {ofertas.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {ofertas.map((p) => (
            <ProductoCard key={p.id} producto={p} />
          ))}
        </div>
      ) : (
        <div className="text-center py-20">
          <p className="text-neutral-400 text-sm">
            No hay ofertas disponibles{cat ? ` en ${cat}` : ""} en este momento.
          </p>
          {cat && (
            <Link href="/ofertas" className="text-[#C4857A] text-sm underline mt-2 inline-block">
              Ver todas las ofertas →
            </Link>
          )}
          {!cat && (
            <Link href="/productos" className="text-[#C4857A] text-sm underline mt-2 inline-block">
              Ver todos los productos →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
