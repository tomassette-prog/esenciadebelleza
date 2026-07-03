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
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const pointerStartX = useRef(0);
  const scrollStartX = useRef(0);
  const didDrag = useRef(false);

  useEffect(() => {
    const el = trackRef.current;
    if (el) el.style.animationPlayState = (paused || isDragging) ? "paused" : "running";
  }, [paused, isDragging]);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // Solo permitir drag con mouse en desktop
    if (e.button !== 0) return; // Solo botón izquierdo
    
    pointerStartX.current = e.clientX;
    scrollStartX.current = containerRef.current?.scrollLeft ?? 0;
    didDrag.current = false;
    setIsDragging(true);
    setPaused(true);
    
    // Prevenir selección de texto mientras dragas
    e.preventDefault();
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging || !containerRef.current) return;
    
    const delta = e.clientX - pointerStartX.current;
    if (Math.abs(delta) > 5) {
      didDrag.current = true;
      containerRef.current.scrollLeft = scrollStartX.current - delta;
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setPaused(false);
  };

  return (
    <section className="py-12 bg-white border-y border-neutral-100 overflow-hidden">
      <style>{`
        .marcas-carrusel-container::-webkit-scrollbar {
          height: 0px;
        }
        .marcas-carrusel-container {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
      `}</style>

      <p className="text-center text-xs tracking-[0.3em] uppercase text-neutral-400 mb-8"
        style={{ fontFamily: "var(--font-inter)" }}>
        Nuestras marcas
      </p>

      <div
        className="relative"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => { if (!isDragging) setPaused(false); }}
      >
        <div className="absolute left-0 top-0 bottom-0 w-16 z-10 bg-gradient-to-r from-white to-transparent pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-16 z-10 bg-gradient-to-l from-white to-transparent pointer-events-none" />

        {/* Contenedor scrollable con drag support */}
        <div
          ref={containerRef}
          className="marcas-carrusel-container flex overflow-x-auto scroll-smooth select-none"
          style={{ scrollBehavior: "smooth", WebkitOverflowScrolling: "touch" }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {/* Track único con duplicación interna */}
          <div ref={trackRef} className="flex items-center" style={{ animation: "marquee 20s linear infinite", width: "200%" }}>
            {/* Primera pasada */}
            {marcas.map((marca) => (
              <Link
                key={`${marca.id}-1`}
                href={`/marcas/${marca.slug}`}
                className="inline-flex flex-col items-center justify-center mx-6 shrink-0 opacity-60 hover:opacity-100 transition-opacity gap-2 w-24 cursor-grab active:cursor-grabbing select-none"
                draggable={false}
                onClick={(e) => { if (didDrag.current) e.preventDefault(); }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={marca.logo_url} alt={marca.nombre} className="h-10 w-auto object-contain max-w-[80px]" loading="lazy" draggable={false} style={{ pointerEvents: "none", userSelect: "none" }}/>
                <span className="text-[9px] tracking-widest uppercase text-neutral-500 text-center leading-tight whitespace-normal w-full">{marca.nombre}</span>
              </Link>
            ))}
            {/* Segunda pasada (loop) */}
            {marcas.map((marca) => (
              <Link
                key={`${marca.id}-2`}
                href={`/marcas/${marca.slug}`}
                className="inline-flex flex-col items-center justify-center mx-6 shrink-0 opacity-60 hover:opacity-100 transition-opacity gap-2 w-24 cursor-grab active:cursor-grabbing select-none"
                draggable={false}
                onClick={(e) => { if (didDrag.current) e.preventDefault(); }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={marca.logo_url} alt={marca.nombre} className="h-10 w-auto object-contain max-w-[80px]" loading="lazy" draggable={false} style={{ pointerEvents: "none", userSelect: "none" }}/>
                <span className="text-[9px] tracking-widest uppercase text-neutral-500 text-center leading-tight whitespace-normal w-full">{marca.nombre}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}


interface Marca {
  id: string;
  nombre: string;
  slug: string;
  logo_url: string;
}