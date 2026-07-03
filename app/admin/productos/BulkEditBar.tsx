"use client";

import { useState, useTransition, useEffect } from "react";
import { actualizarCategoriaBulk, toggleActivoBulk, asignarMarcaBulk } from "@/actions/productos";
import { useRouter } from "next/navigation";

interface Props {
  productoIds: string[];
  onClear: () => void;
  subcategoriasPorCategoria?: Record<string, string[]>;
}

interface MarcaOption {
  id: string;
  nombre: string;
}

export function BulkEditBar({ productoIds, onClear, subcategoriasPorCategoria = {} }: Props) {
  const [isPending, startTransition] = useTransition();
  const [accion, setAccion] = useState<"categoria" | "marca" | "activar" | "desactivar" | null>(null);
  const [categoria, setCategoria] = useState("peluqueria");
  const [subcategoria, setSubcategoria] = useState("peluqueria-general");
  const [marcaId, setMarcaId] = useState("");
  const [marcas, setMarcas] = useState<MarcaOption[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();

  const categorias = Object.keys(subcategoriasPorCategoria).sort();

  useEffect(() => {
    if (accion !== "marca") return;
    // Refetch marcas cada vez que se selecciona "Asignar marca"
    fetch("/api/marcas")
      .then(r => r.json())
      .then((data: MarcaOption[]) => {
        const sorted = [...data].sort((a, b) => a.nombre.localeCompare(b.nombre));
        setMarcas(sorted);
        if (sorted.length > 0) setMarcaId(sorted[0].id);
      })
      .catch(() => {});
  }, [accion]);

  if (productoIds.length === 0) return null;

  function handleAplicar() {
    if (!accion) return;
    setMsg(null);
    startTransition(async () => {
      let res: { ok: number; error?: string };
      if (accion === "categoria") {
        res = await actualizarCategoriaBulk(productoIds, categoria, subcategoria);
      } else if (accion === "marca") {
        res = await asignarMarcaBulk(productoIds, marcaId);
      } else {
        res = await toggleActivoBulk(productoIds, accion === "activar");
      }
      if (res.error) { setMsg("Error: " + res.error); return; }
      setMsg(`✓ ${res.ok} productos actualizados`);
      onClear();
      router.refresh();
    });
  }

  return (
    <div className="sticky top-0 z-20 border border-[#C4857A] bg-white shadow-sm px-4 py-3 flex flex-wrap items-center gap-3">
      <span className="text-sm font-medium text-neutral-700">
        <span className="text-[#3D2018] font-semibold">{productoIds.length}</span> seleccionados
      </span>

      <select
        value={accion ?? ""}
        onChange={e => setAccion(e.target.value as typeof accion)}
        className="text-sm border border-neutral-300 px-2 py-1.5 bg-white"
      >
        <option value="">Acción…</option>
        <option value="categoria">Cambiar categoría</option>
        <option value="marca">Asignar marca</option>
        <option value="activar">Activar</option>
        <option value="desactivar">Desactivar</option>
      </select>

      {accion === "categoria" && (
        <>
          <select
            value={categoria}
            onChange={e => {
              const cat = e.target.value;
              setCategoria(cat);
              const subsPosibles = subcategoriasPorCategoria[cat] ?? [];
              setSubcategoria(subsPosibles[0] ?? "");
            }}
            className="text-sm border border-neutral-300 px-2 py-1.5 bg-white"
          >
            {categorias.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select
            value={subcategoria}
            onChange={e => setSubcategoria(e.target.value)}
            className="text-sm border border-neutral-300 px-2 py-1.5 bg-white"
          >
            {(subcategoriasPorCategoria[categoria] ?? []).map(sub => (
              <option key={sub} value={sub}>{sub}</option>
            ))}
          </select>
        </>
      )}

      {accion === "marca" && (
        <select
          value={marcaId}
          onChange={e => setMarcaId(e.target.value)}
          className="text-sm border border-neutral-300 px-2 py-1.5 bg-white min-w-[160px]"
        >
          {marcas.length === 0 && <option value="">Cargando…</option>}
          {marcas.map(m => (
            <option key={m.id} value={m.id}>{m.nombre}</option>
          ))}
        </select>
      )}

      <button
        onClick={handleAplicar}
        disabled={isPending || !accion}
        className="px-4 py-1.5 bg-[#3D2018] text-white text-xs tracking-widest uppercase hover:bg-neutral-900 disabled:opacity-40 transition-colors"
      >
        {isPending ? "Aplicando…" : "Aplicar"}
      </button>

      <button
        onClick={onClear}
        className="text-sm text-neutral-400 hover:text-neutral-700 underline underline-offset-2"
      >
        Cancelar
      </button>

      {msg && <span className="text-xs text-green-700">{msg}</span>}
    </div>
  );
}
