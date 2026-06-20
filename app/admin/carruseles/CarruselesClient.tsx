"use client";

import { useState, useTransition, useCallback, useRef } from "react";
import { toggleCarruselFlag, buscarProductosCarrusel } from "@/actions/productos";

interface Producto {
  id: string;
  nombre: string;
  marca: string | null;
  imagen_principal_url: string | null;
  oferta: boolean;
  nuevo: boolean;
  destacado: boolean;
}

export function CarruselesClient({ productosIniciales }: { productosIniciales: Producto[] }) {
  const [productos, setProductos] = useState<Producto[]>(productosIniciales);
  const [query, setQuery] = useState("");
  const [buscando, startBuscar] = useTransition();
  const [guardando, startGuardar] = useTransition();
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const buscar = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      startBuscar(async () => {
        const res = await buscarProductosCarrusel(q);
        setProductos(res);
      });
    }, 350);
  }, []);

  const handleQuery = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    buscar(e.target.value);
  };

  const toggle = (
    productoId: string,
    flag: "oferta" | "nuevo" | "destacado",
    valorActual: boolean
  ) => {
    // Optimistic update
    setProductos((prev) =>
      prev.map((p) => (p.id === productoId ? { ...p, [flag]: !valorActual } : p))
    );
    startGuardar(async () => {
      const res = await toggleCarruselFlag(productoId, flag, !valorActual);
      if (res.error) {
        // Revertir en caso de error
        setProductos((prev) =>
          prev.map((p) => (p.id === productoId ? { ...p, [flag]: valorActual } : p))
        );
        setFeedback((f) => ({ ...f, [productoId + flag]: "Error" }));
        setTimeout(() => setFeedback((f) => { const n = { ...f }; delete n[productoId + flag]; return n; }), 2500);
      } else {
        setFeedback((f) => ({ ...f, [productoId + flag]: "✓" }));
        setTimeout(() => setFeedback((f) => { const n = { ...f }; delete n[productoId + flag]; return n; }), 1500);
      }
    });
  };

  const ToggleBtn = ({
    productoId,
    flag,
    activo,
    label,
    color,
  }: {
    productoId: string;
    flag: "oferta" | "nuevo" | "destacado";
    activo: boolean;
    label: string;
    color: string;
  }) => {
    const key = productoId + flag;
    const fb = feedback[key];
    return (
      <button
        onClick={() => toggle(productoId, flag, activo)}
        disabled={guardando}
        title={activo ? `Quitar de ${label}` : `Añadir a ${label}`}
        className={`
          relative px-3 py-1.5 text-[11px] font-medium tracking-wide rounded transition-all border
          ${activo
            ? `${color} text-white border-transparent`
            : "bg-white text-neutral-400 border-neutral-200 hover:border-neutral-400"
          }
          ${guardando ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}
        `}
      >
        {fb ? fb : label}
      </button>
    );
  };

  return (
    <div>
      {/* Buscador */}
      <div className="relative mb-6 max-w-lg">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none"
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803a7.5 7.5 0 0010.607 0z" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={handleQuery}
          placeholder="Buscar producto por nombre…"
          className="w-full pl-9 pr-4 py-2.5 border border-neutral-200 text-sm focus:outline-none focus:border-neutral-400 bg-white"
        />
        {buscando && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-neutral-400 animate-pulse">
            Buscando…
          </span>
        )}
      </div>

      {/* Resultados */}
      {productos.length === 0 && !buscando && (
        <p className="text-sm text-neutral-400 py-8 text-center">
          {query ? "No se encontraron productos." : "Aún no hay productos en ningún carrusel."}
        </p>
      )}

      <div className="grid gap-2">
        {productos.map((p) => (
          <div
            key={p.id}
            className="flex items-center gap-4 p-3 bg-white border border-neutral-100 hover:border-neutral-200 transition-colors"
          >
            {/* Imagen */}
            <div className="w-12 h-12 flex-shrink-0 bg-neutral-50 border border-neutral-100 overflow-hidden">
              {p.imagen_principal_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.imagen_principal_url}
                  alt={p.nombre}
                  className="w-full h-full object-contain"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-neutral-300">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              )}
            </div>

            {/* Nombre y marca */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-neutral-900 truncate">{p.nombre}</p>
              {p.marca && (
                <p className="text-xs text-neutral-400 truncate">{p.marca}</p>
              )}
            </div>

            {/* Toggles */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <ToggleBtn productoId={p.id} flag="oferta" activo={p.oferta} label="Oferta" color="bg-amber-400" />
              <ToggleBtn productoId={p.id} flag="nuevo" activo={p.nuevo} label="Novedad" color="bg-emerald-500" />
              <ToggleBtn productoId={p.id} flag="destacado" activo={p.destacado} label="Destacado" color="bg-sky-500" />
            </div>
          </div>
        ))}
      </div>

      {productos.length > 0 && (
        <p className="text-xs text-neutral-400 mt-4 text-right">
          {productos.length} producto{productos.length !== 1 ? "s" : ""} mostrados
        </p>
      )}
    </div>
  );
}
