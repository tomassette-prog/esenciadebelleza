"use client";

import { useState } from "react";

interface Props {
  categoria: string;
  subcategoriaActual?: string;
  subcategorias: string[];
  cambiarSubcategoria: (value: string) => void;
  cambiarNuevaSubcategoria?: (nueva: boolean) => void;
  permitirNueva?: boolean;
}

/**
 * Componente para seleccionar subcategoría con mejor UX
 * - Si hay subcategorías disponibles: dropdown
 * - Si no hay: input de texto (crear nueva)
 */
export function SubcategoriaSelect({
  categoria,
  subcategoriaActual,
  subcategorias,
  cambiarSubcategoria,
  cambiarNuevaSubcategoria,
  permitirNueva = true,
}: Props) {
  const [enCreacion, setEnCreacion] = useState(false);
  const [valor, setValor] = useState(subcategoriaActual ?? "");

  const handleSeleccionar = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const v = e.target.value;
    if (v === "__nueva__") {
      setEnCreacion(true);
      cambiarNuevaSubcategoria?.(true);
      setValor("");
    } else {
      setEnCreacion(false);
      cambiarNuevaSubcategoria?.(false);
      setValor(v);
      cambiarSubcategoria(v);
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.toLowerCase().replace(/\s+/g, "-");
    setValor(v);
    cambiarSubcategoria(v);
  };

  const handleVolver = () => {
    setEnCreacion(false);
    cambiarNuevaSubcategoria?.(false);
    setValor(subcategoriaActual ?? "");
    cambiarSubcategoria(subcategoriaActual ?? "");
  };

  if (subcategorias.length === 0) {
    return (
      <div>
        <input
          type="text"
          name="subcategoria"
          value={valor}
          onChange={handleInput}
          className="input-clean w-full"
          placeholder="ej: nueva-subcategoria"
        />
        <p className="text-xs text-neutral-400 mt-1">
          No hay subcategorías para {categoria}. Crea una nueva.
        </p>
      </div>
    );
  }

  if (enCreacion) {
    return (
      <div className="flex gap-2">
        <input
          type="text"
          name="subcategoria"
          value={valor}
          onChange={handleInput}
          className="input-clean w-full"
          placeholder="ej: nueva-subcategoria"
          autoFocus
        />
        <button
          type="button"
          onClick={handleVolver}
          className="text-xs text-neutral-400 hover:text-neutral-700 whitespace-nowrap px-2"
        >
          ← Volver
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <select
        name="subcategoria"
        value={valor}
        onChange={handleSeleccionar}
        className="input-clean w-full"
      >
        <option value="">— Seleccionar subcategoría —</option>
        {subcategorias.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
        {permitirNueva && <option value="__nueva__">+ Nueva subcategoría...</option>}
      </select>
      {permitirNueva && (
        <p className="text-xs text-neutral-400">
          ℹ️ Las opciones anteriores incluyen subcategorías dinámicas y de productos existentes.
        </p>
      )}
    </div>
  );
}
