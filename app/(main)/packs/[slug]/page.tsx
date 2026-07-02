import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPackBySlug } from "@/actions/packs";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { AgregarPackBtn } from "../AgregarPackBtn";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const pack = await getPackBySlug(slug);
  if (!pack) return { title: "Pack no encontrado" };
  return {
    title: `${pack.nombre} | Packs de regalo | Esencia de Belleza`,
    description: pack.descripcion ?? `Pack de regalo: ${pack.nombre}. ${pack.items.length} productos incluidos por ${pack.precio_pack.toFixed(2)} €.`,
    openGraph: pack.imagen_url ? { images: [pack.imagen_url] } : undefined,
  };
}

export default async function PackPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const pack = await getPackBySlug(slug);
  if (!pack) notFound();

  const ahorro = pack.precio_original ? pack.precio_original - pack.precio_pack : null;
  const pct    = ahorro && pack.precio_original ? Math.round((ahorro / pack.precio_original) * 100) : null;

  return (
    <main className="container-main py-10 lg:py-14">
      <Breadcrumb
        items={[{ label: "Packs de regalo", href: "/packs" }, { label: pack.nombre }]}
        className="mb-8"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16">
        {/* Imagen */}
        <div className="relative aspect-square bg-neutral-50 border border-neutral-100">
          {pack.imagen_url ? (
            <Image src={pack.imagen_url} alt={pack.nombre} fill sizes="(max-width:1024px) 100vw, 50vw"
              className="object-contain p-6" priority unoptimized />
          ) : (
            <div className="flex items-center justify-center h-full text-8xl">🎁</div>
          )}
          {pct && (
            <span className="absolute top-4 left-4 bg-[#C4857A] text-white text-xs px-3 py-1.5 tracking-wide">
              -{pct}% de descuento
            </span>
          )}
        </div>

        {/* Detalles */}
        <div className="flex flex-col">
          <h1 className="text-3xl font-light text-neutral-900 mb-3" style={{ fontFamily: "var(--font-cormorant)" }}>
            {pack.nombre}
          </h1>

          {pack.descripcion && (
            <p className="text-sm text-neutral-600 leading-relaxed mb-6">{pack.descripcion}</p>
          )}

          {/* Precio */}
          <div className="flex items-end gap-3 mb-2">
            <span className="text-3xl font-semibold text-[#3D2018]">{pack.precio_pack.toFixed(2)} €</span>
            {pack.precio_original && (
              <span className="text-lg text-neutral-400 line-through mb-0.5">{pack.precio_original.toFixed(2)} €</span>
            )}
          </div>
          {ahorro && (
            <p className="text-sm text-green-700 mb-6">
              Ahorras <strong>{ahorro.toFixed(2)} €</strong> comprando en pack
            </p>
          )}

          {/* Stock */}
          <p className="text-xs text-neutral-400 mb-6">
            {pack.stock_disponible > 0
              ? `${pack.stock_disponible} unidades disponibles`
              : "Actualmente agotado"}
          </p>

          <AgregarPackBtn pack={pack} />

          {/* Productos incluidos */}
          <div className="mt-10">
            <h2 className="text-xs font-medium uppercase tracking-widest text-neutral-500 mb-4">
              Productos incluidos en este pack
            </h2>
            <ul className="space-y-3">
              {pack.items.map((item) => {
                const padre = item.variacion?.producto_padre;
                return (
                  <li key={item.id} className="flex items-center gap-4 p-3 border border-neutral-100 bg-neutral-50">
                    {item.variacion?.imagen_url && (
                      <Image src={item.variacion.imagen_url} alt="" width={48} height={48}
                        className="w-12 h-12 object-contain bg-white border border-neutral-100 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-neutral-900 line-clamp-1">
                        {padre?.nombre ?? "Producto"}
                        {item.variacion?.nombre_variacion && item.variacion.nombre_variacion !== "Unidad"
                          ? ` — ${item.variacion.nombre_variacion}` : ""}
                      </p>
                      <p className="text-xs text-neutral-400">
                        {item.variacion?.precio_b2c.toFixed(2)} € · ×{item.cantidad}
                        {padre && (
                          <Link
                            href={`/productos/${padre.categoria}/${padre.subcategoria ?? "general"}/${padre.slug}`}
                            className="ml-2 underline hover:text-neutral-700"
                          >
                            Ver producto
                          </Link>
                        )}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </main>
  );
}
