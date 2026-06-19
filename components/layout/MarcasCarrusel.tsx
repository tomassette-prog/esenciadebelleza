"use client";

import { useRef, useState, useEffect } from "react";
import Link from "next/link";

interface Marca {
  id: string;
  nombre: string;
  slug: string;
  logo_url: string;
}

interface Props {
  marcas: Marca[];
}

export default function MarcasCarrusel({ marcas }: Props) {
  const trackRef    = useRef<HTMLDivElement>(null);
  const [paused,    setPaused]    = useState(false);
  const [dragging,  setDragging]  = useState(false);
  const [startX,    setStartX]    = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  // Duplicar para loop visual
  const items = [...marcas, ...marcas];

  // ── Drag / swipe ────────────────────────────────────────────────────────────
  function onPointerDown(e: React.PointerEvent) {
    if (!trackRef.current) return;
    setDragging(true);
    setPaused(true);
    setStartX(e.clientX);
    setScrollLeft(trackRef.current.scrollLeft);
    trackRef.current.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragging || !trackRef.current) return;
    const delta = e.clientX - startX;
    trackRef.current.scrollLeft = scrollLeft - delta;
  }

  function onPointerUp() {
    setDragging(false);
    // Retomar animación tras breve pausa
    setTimeout(() => setPaused(false), 1200);
  }

  // Sincronizar CSS pause con estado
  useEffect(() => {
    if (!trackRef.current) return;
    const el = trackRef.current;
    el.style.animationPlayState = paused ? "paused" : "running";
  }, [paused]);

  return (
    <section className="py-12 bg-white border-y border-neutral-100 overflow-hidden">
      <p
        className="text-center text-xs tracking-[0.3em] uppercase text-neutral-400 mb-8"
        style={{ fontFamily: "var(--font-inter)" }}
      >
        Nuestras marcas
      </p>

      <div className="relative select-none">
        {/* Gradientes laterales */}
        <div className="absolute left-0 top-0 bottom-0 w-16 z-10 bg-gradient-to-r from-white to-transparent pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-16 z-10 bg-gradient-to-l from-white to-transparent pointer-events-none" />

        {/* Track — scroll horizontal + marquee */}
        <div
          ref={trackRef}
          className={`flex whitespace-nowrap overflow-x-auto scrollbar-hide ${dragging ? "cursor-grabbing" : "cursor-grab"}`}
          style={{
            animation: `marquee 30s linear infinite`,
            animationPlayState: paused ? "paused" : "running",
            WebkitOverflowScrolling: "touch",
            scrollbarWidth: "none",
            msOverflowStyle: "none",
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => !dragging && setPaused(false)}
        >
          {items.map((marca, i) => (
            <Link
              key={`${marca.id}-${i}`}
              href={`/marcas/${marca.slug}`}
              draggable={false}
              className="inline-flex flex-col items-center justify-center mx-6 shrink-0 opacity-60 hover:opacity-100 transition-opacity gap-2 w-24"
              onClick={(e) => { if (dragging) e.preventDefault(); }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={marca.logo_url}
                alt={marca.nombre}
                className="h-10 w-auto object-contain max-w-[80px]"
                loading="lazy"
                draggable={false}
              />
              <span className="text-[9px] tracking-widest uppercase text-neutral-500 text-center leading-tight whitespace-normal w-full">
                {marca.nombre}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
