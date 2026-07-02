import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { getPacksActivos } from "@/actions/packs";
import { Breadcrumb } from "@/components/layout/Breadcrumb";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Packs de regalo | Esencia de Belleza",
  description: "Descubre nuestros packs de productos de peluquería y estética, ideales para regalo. Ahorra comprando en pack.",
};

export default async function PacksPage() {
  const packs = await getPacksActivos();

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

      {packs.length === 0 ? (
        <p className="text-sm text-neutral-400 text-center py-20">Próximamente…</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {packs.map((pack) => {
            const ahorro = pack.precio_original ? pack.precio_original - pack.precio_pack : null;
            const pct    = ahorro && pack.precio_original ? Math.round((ahorro / pack.precio_original) * 100) : null;
            return (
              <Link key={pack.id} href={`/packs/${pack.slug}`}
                className="group block border border-neutral-200 hover:border-[#C4857A] transition-colors">
                {/* Imagen */}
                <div className="relative aspect-square bg-neutral-50 overflow-hidden">
                  {pack.imagen_url ? (
                    <Image src={pack.imagen_url} alt={pack.nombre} fill sizes="(max-width:640px) 100vw, (max-width:1024px) 50vw, 33vw"
                      className="object-contain p-4 group-hover:scale-105 transition-transform duration-300" />
                  ) : (
                    <div className="flex items-center justify-center h-full text-6xl">🎁</div>
                  )}
                  {pct && (
                    <span className="absolute top-3 left-3 bg-[#C4857A] text-white text-xs px-2 py-1 tracking-wide">
                      -{pct}%
                    </span>
                  )}
                  {pack.stock_disponible === 0 && (
                    <span className="absolute top-3 right-3 bg-neutral-900 text-white text-xs px-2 py-1">
                      Agotado
                    </span>
                  )}
                </div>

                {/* Info */}
                <div className="p-5">
                  <h2 className="font-medium text-neutral-900 line-clamp-2 mb-1">{pack.nombre}</h2>
                  {pack.descripcion && (
                    <p className="text-xs text-neutral-500 line-clamp-2 mb-3">{pack.descripcion}</p>
                  )}
                  <div className="flex items-end gap-2 mt-auto">
                    <span className="text-lg font-semibold text-[#3D2018]">
                      {pack.precio_pack.toFixed(2)} €
                    </span>
                    {pack.precio_original && (
                      <span className="text-sm text-neutral-400 line-through mb-0.5">
                        {pack.precio_original.toFixed(2)} €
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-neutral-400 mt-1">{pack.items.length} producto{pack.items.length !== 1 ? "s" : ""} incluidos</p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
