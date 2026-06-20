"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback, useRef, useTransition } from "react";

interface Props {
  categorias: string[];
  marcas: { id: string; nombre: string }[];
  subcategorias: string[];
  currentQ?: string;
  currentCat?: string;
  currentSubcat?: string;
  currentMarca?: string;
  currentEstado?: string;
  currentFlag?: string;
}

export function FiltrosProductos({
  categorias,
  marcas,
  subcategorias,
  currentQ = "",
  currentCat = "",
  currentSubcat = "",
  currentMarca = "",
  currentEstado = "",
  currentFlag = "",
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const buildURL = useCallback(
    (overrides: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      // Reset page when filters change
      params.delete("page");
      for (const [key, value] of Object.entries(overrides)) {
        if (value) params.set(key, value);
        else params.delete(key);
      }
      return `${pathname}?${params.toString()}`;
    },
    [pathname, searchParams]
  );

  const navigate = useCallback(
    (overrides: Record<string, string>) => {
      startTransition(() => {
        router.push(buildURL(overrides));
      });
    },
    [buildURL, router]
  );

  const handleQ = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const val = e.target.value;
    debounceRef.current = setTimeout(() => navigate({ q: val }), 400);
  };

  const handleCat = (e: React.ChangeEvent<HTMLSelectElement>) => {
    navigate({ cat: e.target.value, subcat: "" });
  };

  const handleSelect = (key: string) => (e: React.ChangeEvent<HTMLSelectElement>) => {
    navigate({ [key]: e.target.value });
  };

  const reset = () => navigate({ q: "", cat: "", subcat: "", marca: "", estado: "", flag: "" });

  const hasFilters = currentQ || currentCat || currentSubcat || currentMarca || currentEstado || currentFlag;

  return (
    <div className={`bg-white border border-neutral-200 p-4 space-y-3 transition-opacity ${isPending ? "opacity-60 pointer-events-none" : ""}`}>
      <div className="flex flex-wrap gap-3">
        {/* Búsqueda libre — nombre */}
        <div className="relative flex-1 min-w-56">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803a7.5 7.5 0 0010.607 0z" />
          </svg>
          <input
            type="text"
            defaultValue={currentQ}
            onChange={handleQ}
            placeholder="Buscar por nombre de producto…"
            className="w-full pl-9 pr-3 py-2 border border-neutral-200 text-sm focus:outline-none focus:border-neutral-400 bg-white"
          />
        </div>

        {/* Marca */}
        <select
          value={currentMarca}
          onChange={handleSelect("marca")}
          className="input-clean text-sm min-w-44 max-w-56"
        >
          <option value="">Todas las marcas</option>
          {marcas.map((m) => (
            <option key={m.id} value={m.id}>{m.nombre}</option>
          ))}
        </select>

        {/* Categoría */}
        <select
          value={currentCat}
          onChange={handleCat}
          className="input-clean text-sm min-w-44 max-w-56"
        >
          <option value="">Todas las categorías</option>
          {categorias.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        {/* Subcategoría — aparece solo cuando hay categoría seleccionada */}
        {currentCat && subcategorias.length > 0 && (
          <select
            value={currentSubcat}
            onChange={handleSelect("subcat")}
            className="input-clean text-sm min-w-44 max-w-56"
          >
            <option value="">Todas las subcategorías</option>
            {subcategorias.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        )}

        {/* Estado activo/inactivo */}
        <select
          value={currentEstado}
          onChange={handleSelect("estado")}
          className="input-clean text-sm min-w-32"
        >
          <option value="">Activos e inactivos</option>
          <option value="activo">Solo activos</option>
          <option value="inactivo">Solo inactivos</option>
        </select>

        {/* Flags */}
        <select
          value={currentFlag}
          onChange={handleSelect("flag")}
          className="input-clean text-sm min-w-36"
        >
          <option value="">Sin filtro de carrusel</option>
          <option value="oferta">En oferta</option>
          <option value="nuevo">Novedades</option>
          <option value="destacado">Destacados</option>
        </select>
      </div>

      {/* Chips de filtros activos + reset */}
      {hasFilters && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-xs text-neutral-400">Filtros activos:</span>
          {currentQ && <Chip label={`"${currentQ}"`} onRemove={() => navigate({ q: "" })} />}
          {currentMarca && <Chip label={marcas.find(m => m.id === currentMarca)?.nombre ?? currentMarca} onRemove={() => navigate({ marca: "" })} />}
          {currentCat && <Chip label={currentCat} onRemove={() => navigate({ cat: "", subcat: "" })} />}
          {currentSubcat && <Chip label={currentSubcat} onRemove={() => navigate({ subcat: "" })} />}
          {currentEstado && <Chip label={currentEstado} onRemove={() => navigate({ estado: "" })} />}
          {currentFlag && <Chip label={currentFlag} onRemove={() => navigate({ flag: "" })} />}
          <button onClick={reset} className="text-xs text-neutral-400 hover:text-red-500 underline underline-offset-2 transition-colors ml-1">
            Limpiar todo
          </button>
        </div>
      )}

      {isPending && (
        <p className="text-xs text-neutral-400 animate-pulse">Buscando…</p>
      )}
    </div>
  );
}

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-neutral-100 border border-neutral-200 text-xs text-neutral-700">
      {label}
      <button onClick={onRemove} className="text-neutral-400 hover:text-neutral-700 leading-none">&times;</button>
    </span>
  );
}
