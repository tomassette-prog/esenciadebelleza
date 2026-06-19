"use client";

import Link from "next/link";
import type { ProductoCatalogo } from "@/types/producto";
import { ProductoCard } from "@/components/producto/ProductoCard";

interface Props {
  productos: ProductoCatalogo[];
  titulo: string;
  subtitulo?: string;
  verTodosHref?: string;
}

export function CarruselProductos({ productos, titulo, subtitulo, verTodosHref = "/productos" }: Props) {
  if (!productos.length) return null;

  return (
    <section className="py-16 bg-white overflow-hidden">
      <div className="container-main">
        <div className="flex items-baseline justify-between mb-8 px-0">
          <div>
            {subtitulo && (
              <p className="text-xs tracking-[0.3em] uppercase mb-1" style={{ color: "var(--color-oro)" }}>
                {subtitulo}
              </p>
            )}
            <h2 className="text-2xl font-light text-neutral-900" style={{ fontFamily: "var(--font-cormorant)" }}>
              {titulo}
            </h2>
          </div>
          <Link
            href={verTodosHref}
            className="text-xs tracking-widest uppercase text-neutral-400 hover:text-neutral-700 transition-colors"
          >
            Ver todos →
          </Link>
        </div>
      </div>

      {/* Scroll horizontal sin scrollbar visible */}
      <div className="relative">
        <div
          className="flex gap-4 overflow-x-auto scroll-smooth pb-2 px-6"
          style={{
            scrollbarWidth: "none",
            msOverflowStyle: "none",
          }}
        >
          {productos.map((p, i) => (
            <div key={p.id} className="flex-shrink-0 w-52 sm:w-60">
              <ProductoCard producto={p} priority={i < 3} />
            </div>
          ))}
        </div>
        {/* Gradiente derecha */}
        <div className="pointer-events-none absolute top-0 right-0 h-full w-16 bg-gradient-to-l from-white to-transparent" />
      </div>
    </section>
  );
}
