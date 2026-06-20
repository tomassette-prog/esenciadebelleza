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
  const track1Ref = useRef<HTMLDivElement>(null);
  const track2Ref = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const pointerStartX = useRef(0);
  const didDrag = useRef(false);

  useEffect(() => {
    const els = [track1Ref.current, track2Ref.current].filter(Boolean);
    els.forEach((el) => {
      if (el) el.style.animationPlayState = paused ? "paused" : "running";
    });
  }, [paused]);

  return (
    <section className="py-12 bg-white border-y border-neutral-100 overflow-hidden">
      <p className="text-center text-xs tracking-[0.3em] uppercase text-neutral-400 mb-8"
        style={{ fontFamily: "var(--font-inter)" }}>
        Nuestras marcas
      </p>

      <div
        className="relative"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <div className="absolute left-0 top-0 bottom-0 w-16 z-10 bg-gradient-to-r from-white to-transparent pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-16 z-10 bg-gradient-to-l from-white to-transparent pointer-events-none" />

        {/* Dos tracks independientes para loop infinito sin overflow */}
        <div className="flex" style={{ width: "200%" }}>
          <div ref={track1Ref} className="flex items-center" style={{ animation: "marquee 30s linear infinite", width: "50%" }}>
            {marcas.map((marca) => (
              <Link
                key={marca.id}
                href={`/marcas/${marca.slug}`}
                className="inline-flex flex-col items-center justify-center mx-6 shrink-0 opacity-60 hover:opacity-100 transition-opacity gap-2 w-24"
                draggable={false}
                onPointerDown={(e) => { pointerStartX.current = e.clientX; didDrag.current = false; }}
                onPointerMove={(e) => { if (Math.abs(e.clientX - pointerStartX.current) > 5) didDrag.current = true; }}
                onClick={(e) => { if (didDrag.current) e.preventDefault(); }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={marca.logo_url} alt={marca.nombre} className="h-10 w-auto object-contain max-w-[80px]" loading="lazy" draggable={false}/>
                <span className="text-[9px] tracking-widest uppercase text-neutral-500 text-center leading-tight whitespace-normal w-full">{marca.nombre}</span>
              </Link>
            ))}
          </div>
          <div ref={track2Ref} className="flex items-center" style={{ animation: "marquee 30s linear infinite", width: "50%" }} aria-hidden="true">
            {marcas.map((marca) => (
              <span key={marca.id} className="inline-flex flex-col items-center justify-center mx-6 shrink-0 opacity-60 gap-2 w-24">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={marca.logo_url} alt="" className="h-10 w-auto object-contain max-w-[80px]" loading="lazy" draggable={false}/>
                <span className="text-[9px] tracking-widest uppercase text-neutral-500 text-center leading-tight whitespace-normal w-full">{marca.nombre}</span>
              </span>
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



