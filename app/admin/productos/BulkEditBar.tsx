"use client";

import { useState, useTransition, useEffect } from "react";
import { actualizarCategoriaBulk, toggleActivoBulk, asignarMarcaBulk } from "@/actions/productos";
import { getAllCategoriaPairs, type CategoriaPair } from "@/lib/category-suggester";
import { useRouter } from "next/navigation";

interface Props {
  productoIds: string[];
  onClear: () => void;
}

interface MarcaOption {
  id: string;
  nombre: string;
}

export function BulkEditBar({ productoIds, onClear }: Props) {
  const [isPending, startTransition] = useTransition();
  const [accion, setAccion] = useState<"categoria" | "marca" | "activar" | "desactivar" | null>(null);
  const [categoria, setCategoria] = useState("peluqueria");
  const [subcategoria, setSubcategoria] = useState("peluqueria-general");
  const [marcaId, setMarcaId] = useState("");
  const [marcas, setMarcas] = useState<MarcaOption[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();

  const allPairs: CategoriaPair[] = getAllCategoriaPairs();
  const categorias = [...new Set(allPairs.map(p => p.categoria))];

  useEffect(() => {
    if (accion !== "marca" || marcas.length > 0) return;
    fetch("/api/marcas")
      .then(r => r.json())
      .then((data: MarcaOption[]) => {
        const sorted = [...data].sort((a, b) => a.nombre.localeCompare(b.nombre));
        setMarcas(sorted);
        if (sorted.length > 0) setMarcaId(sorted[0].id);
      })
      .catch(() => {});
  }, [accion, marcas.length]);

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
              setCategoria(e.target.value);
              setSubcategoria(allPairs.find(p => p.categoria === e.target.value)?.subcategoria ?? "");
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
            {allPairs.filter(p => p.categoria === categoria).map(p => (
              <option key={p.subcategoria} value={p.subcategoria}>
                {p.label.split(" › ")[1]}
              </option>
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
