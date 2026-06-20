"use client";

import { useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import type { ProductoCatalogo } from "@/types/producto";
import { ProductoCard } from "@/components/producto/ProductoCard";

interface Props {
  productos: ProductoCatalogo[];
  titulo: string;
  subtitulo?: string;
  verTodosHref?: string;
  autoScrollMs?: number; // 0 = sin auto-scroll
}

export function CarruselProductos({ productos, titulo, subtitulo, verTodosHref = "/productos", autoScrollMs = 4000 }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const pausadoRef = useRef(false);

  if (!productos.length) return null;

  const scroll = (dir: "left" | "right") => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({ left: dir === "right" ? 280 : -280, behavior: "smooth" });
  };

  // Auto-scroll circular
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const autoScroll = useCallback(() => {
    if (!scrollRef.current || pausadoRef.current) return;
    const el = scrollRef.current;
    const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 10;
    if (atEnd) {
      el.scrollTo({ left: 0, behavior: "smooth" });
    } else {
      el.scrollBy({ left: 280, behavior: "smooth" });
    }
  }, []);

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (!autoScrollMs) return;
    const interval = setInterval(autoScroll, autoScrollMs);
    return () => clearInterval(interval);
  }, [autoScroll, autoScrollMs]);

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
          <div className="flex items-center gap-3">
            <button
              onClick={() => scroll("left")}
              aria-label="Anterior"
              className="w-9 h-9 flex items-center justify-center border border-neutral-200 text-neutral-500 hover:border-neutral-400 hover:text-neutral-900 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>
            <button
              onClick={() => scroll("right")}
              aria-label="Siguiente"
              className="w-9 h-9 flex items-center justify-center border border-neutral-200 text-neutral-500 hover:border-neutral-400 hover:text-neutral-900 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
            <Link
              href={verTodosHref}
              className="text-xs tracking-widest uppercase text-neutral-400 hover:text-neutral-700 transition-colors hidden sm:block"
            >
              Ver todos →
            </Link>
          </div>
        </div>
      </div>

      {/* Scroll horizontal sin scrollbar visible */}
      <div className="relative">
        <div
          ref={scrollRef}
          onMouseEnter={() => { pausadoRef.current = true; }}
          onMouseLeave={() => { pausadoRef.current = false; }}
          onTouchStart={() => { pausadoRef.current = true; }}
          onTouchEnd={() => { setTimeout(() => { pausadoRef.current = false; }, 2000); }}
          className="flex gap-4 overflow-x-auto scroll-smooth pb-2 px-6"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {productos.map((p, i) => (
            <div key={p.id} className="flex-shrink-0 w-52 sm:w-60">
              <ProductoCard producto={p} priority={i < 3} />
            </div>
          ))}
        </div>
        {/* Gradientes laterales */}
        <div className="pointer-events-none absolute top-0 left-0 h-full w-10 bg-gradient-to-r from-white to-transparent" />
        <div className="pointer-events-none absolute top-0 right-0 h-full w-16 bg-gradient-to-l from-white to-transparent" />
      </div>

      <div className="container-main mt-4 sm:hidden">
        <Link href={verTodosHref} className="text-xs tracking-widest uppercase text-neutral-400 hover:text-neutral-700 transition-colors">
          Ver todos →
        </Link>
      </div>
    </section>
  );
}
