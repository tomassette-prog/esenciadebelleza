import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { getPacksActivos } from "@/actions/packs";
import { createAdminClient } from "@/lib/supabase/admin";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { slugifyCategoria } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Packs de regalo | Esencia de Belleza",
  description: "Descubre nuestros packs de productos de peluquería y estética, ideales para regalo. Ahorra comprando en pack.",
};

interface ProductoPack {
  id: string;
  nombre: string;
  slug: string;
  categoria: string;
  subcategoria: string | null;
  imagen_principal_url: string | null;
  precio_desde: number;
}

export default async function PacksPage() {
  const supabase = createAdminClient();

  const [packsCustom, { data: productosPackRaw }] = await Promise.all([
    getPacksActivos(),
    supabase
      .from("productos_padre")
      .select(`
        id, nombre, slug, categoria, subcategoria, imagen_principal_url,
        variaciones:productos_variaciones(precio_b2c, activa)
      `)
      .eq("activo", true)
      .eq("es_pack", true)
      .order("nombre"),
  ]);

  const productosPack: ProductoPack[] = (productosPackRaw ?? []).map((p) => {
    const vars = (p.variaciones ?? []).filter((v: { activa: boolean }) => v.activa);
    const precio = vars.length > 0 ? Math.min(...vars.map((v: { precio_b2c: number }) => v.precio_b2c)) : 0;
    return { id: p.id, nombre: p.nombre, slug: p.slug, categoria: p.categoria, subcategoria: p.subcategoria, imagen_principal_url: p.imagen_principal_url, precio_desde: precio };
  });

  const totalItems = packsCustom.length + productosPack.length;

  return (
    <main className="container-main py-10 lg:py-14">
      <Breadcrumb items={[{ label: "Packs de regalo" }]} className="mb-6" />

      <div className="mb-10">
        <h1 className="text-3xl lg:text-4xl font-light text-neutral-900" style={{ fontFamily: "var(--font-cormorant)" }}>
          Packs de regalo
        </h1>
        <p className="text-sm text-neutral-500 mt-2">
          Combinaciones seleccionadas de productos profesionales, perfectas para regalar.
        </p>
      </div>

      {totalItems === 0 ? (
        <p className="text-sm text-neutral-400 text-center py-20">Próximamente…</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {/* Packs personalizados (tabla packs_regalo) */}
          {packsCustom.map((pack) => {
            const ahorro = pack.precio_original ? pack.precio_original - pack.precio_pack : null;
            const pct    = ahorro && pack.precio_original ? Math.round((ahorro / pack.precio_original) * 100) : null;
            return (
              <Link key={pack.id} href={`/packs/${pack.slug}`}
                className="group block border border-neutral-200 hover:border-[#C4857A] transition-colors">
                <div className="relative aspect-square bg-neutral-50 overflow-hidden">
                  {pack.imagen_url ? (
                    <Image src={pack.imagen_url} alt={pack.nombre} fill sizes="(max-width:640px) 100vw, (max-width:1024px) 50vw, 33vw"
                      className="object-contain p-4 group-hover:scale-105 transition-transform duration-300"
                      unoptimized />
                  ) : (
                    <div className="flex items-center justify-center h-full text-6xl">🎁</div>
                  )}
                  {pct && (
                    <span className="absolute top-3 left-3 bg-[#C4857A] text-white text-xs px-2 py-1 tracking-wide">-{pct}%</span>
                  )}
                  {pack.stock_disponible === 0 && (
                    <span className="absolute top-3 right-3 bg-neutral-900 text-white text-xs px-2 py-1">Agotado</span>
                  )}
                </div>
                <div className="p-5">
                  <h2 className="font-medium text-neutral-900 line-clamp-2 mb-1">{pack.nombre}</h2>
                  {pack.descripcion && <p className="text-xs text-neutral-500 line-clamp-2 mb-3">{pack.descripcion}</p>}
                  <div className="flex items-end gap-2">
                    <span className="text-lg font-semibold text-[#3D2018]">{pack.precio_pack.toFixed(2)} €</span>
                    {pack.precio_original && <span className="text-sm text-neutral-400 line-through mb-0.5">{pack.precio_original.toFixed(2)} €</span>}
                  </div>
                  <p className="text-xs text-neutral-400 mt-1">{pack.items.length} producto{pack.items.length !== 1 ? "s" : ""} incluidos</p>
                </div>
              </Link>
            );
          })}

          {/* Productos del proveedor marcados como pack */}
          {productosPack.map((p) => (
            <Link key={p.id} href={`/productos/${slugifyCategoria(p.categoria)}/${slugifyCategoria(p.subcategoria ?? "general")}/${p.slug}`}
              className="group block border border-neutral-200 hover:border-[#C4857A] transition-colors">
              <div className="relative aspect-square bg-neutral-50 overflow-hidden">
                {p.imagen_principal_url ? (
                  <Image src={p.imagen_principal_url} alt={p.nombre} fill
                    sizes="(max-width:640px) 100vw, (max-width:1024px) 50vw, 33vw"
                    className="object-contain p-4 group-hover:scale-105 transition-transform duration-300"
                    unoptimized />
                ) : (
                  <div className="flex items-center justify-center h-full text-6xl">🎁</div>
                )}
              </div>
              <div className="p-5">
                <h2 className="font-medium text-neutral-900 line-clamp-2 mb-1">{p.nombre}</h2>
                {p.precio_desde > 0 && (
                  <span className="text-lg font-semibold text-[#3D2018]">{p.precio_desde.toFixed(2)} €</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
