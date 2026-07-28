"use client";

import { useRef, useState, useEffect } from "react";
import Link from "next/link";
import type { ProductoCatalogo } from "@/types/producto";
import { ProductoCard } from "@/components/producto/ProductoCard";

interface Props {
  productos: ProductoCatalogo[];
  titulo: string;
  subtitulo?: string;
  verTodosHref?: string;
  autoScrollMs?: number; // duración total de una vuelta en ms (default 25 s)
}

export function CarruselProductos({ productos, titulo, subtitulo, verTodosHref = "/productos", autoScrollMs = 25000 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const pointerStartX = useRef(0);
  const scrollStartX = useRef(0);
  const didDrag = useRef(false);
  const isPointerDown = useRef(false);

  // Sincronizar estado pausado con la animación CSS
  useEffect(() => {
    const el = trackRef.current;
    if (el) el.style.animationPlayState = paused ? "paused" : "running";
  }, [paused]);

  const handlePointerDown = (e: React.PointerEvent) => {
    isPointerDown.current = true;
    pointerStartX.current = e.clientX;
    scrollStartX.current = containerRef.current?.scrollLeft ?? 0;
    didDrag.current = false;
    // Pausar animación inmediatamente para que el usuario pueda arrastrar
    setPaused(true);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isPointerDown.current || !containerRef.current) return;
    const delta = e.clientX - pointerStartX.current;
    if (Math.abs(delta) > 5) {
      didDrag.current = true;
      // Deshabilitar pointer events en las tarjetas para que no intercepten el drag
      if (trackRef.current) {
        trackRef.current.style.pointerEvents = "none";
      }
      containerRef.current.scrollLeft = scrollStartX.current - delta;
    }
  };

  const handlePointerUp = () => {
    isPointerDown.current = false;
    // Rehabilitar pointer events en las tarjetas
    if (trackRef.current) {
      trackRef.current.style.pointerEvents = "auto";
    }
    // Reanudar animación solo si el ratón ya no está sobre el carrusel
    // (onMouseLeave se encargará si sigue encima)
  };

  if (!productos.length) return null;

  const duration = `${Math.round(autoScrollMs / 1000)}s`;

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

      {/* Marquee continuo con track único + drag interactivo */}
      <div
        className="relative"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => { if (!isPointerDown.current) setPaused(false); }}
      >
        {/* Gradientes laterales */}
        <div className="pointer-events-none absolute top-0 left-0 h-full w-16 z-10 bg-gradient-to-r from-white to-transparent" />
        <div className="pointer-events-none absolute top-0 right-0 h-full w-16 z-10 bg-gradient-to-l from-white to-transparent" />

        <div
          ref={containerRef}
          className="flex overflow-x-auto scroll-smooth"
          style={{ scrollBehavior: "smooth", WebkitOverflowScrolling: "touch" }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        >
          {/* Track único con duplicación interna */}
          <div
            ref={trackRef}
            className="flex items-start gap-4 px-4"
            style={{ animation: `marquee ${duration} linear infinite`, width: "200%" }}
          >
            {/* Primera pasada */}
            {productos.map((p, i) => (
              <div key={`${p.id}-1`} className="flex-shrink-0 w-52 sm:w-60 select-none">
                <ProductoCard producto={p} priority={i < 3} />
              </div>
            ))}
            {/* Segunda pasada (loop) */}
            {productos.map((p) => (
              <div key={`${p.id}-2`} className="flex-shrink-0 w-52 sm:w-60 select-none">
                <ProductoCard producto={p} priority={false} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
