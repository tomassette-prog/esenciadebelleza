import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { ProductoCard } from "@/components/producto/ProductoCard";
import type { ProductoCatalogo } from "@/types/producto";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Ofertas | Esencia de Belleza",
  description: "Productos en oferta con los mejores precios. Descuentos en marcas profesionales de peluquería, estética y perfumería.",
};

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

export default async function OfertasPage() {
  const supabase = createAdminClient();

  const { data: ofertasRaw } = await supabase
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
    .range(0, 199);

  const ofertas: ProductoCatalogo[] = (ofertasRaw ?? []).map(toProductoCatalogo);

  return (
    <div className="container-main py-8">
      {/* Header */}
      <div className="mb-8">
        <h1
          className="text-3xl md:text-4xl font-light text-neutral-900"
          style={{ fontFamily: "var(--font-cormorant)" }}
        >
          Ofertas
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
        <span className="text-neutral-600">Ofertas</span>
      </nav>

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
            No hay ofertas disponibles en este momento.
          </p>
          <Link href="/productos" className="text-[#C4857A] text-sm underline mt-2 inline-block">
            Ver todos los productos →
          </Link>
        </div>
      )}
    </div>
  );
}
