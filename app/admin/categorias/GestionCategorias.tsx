"use client";

import { useState, useTransition } from "react";
import { getAllCategoriaPairs } from "@/lib/category-suggester";
import { guardarMapeoCategoria, eliminarMapeoCategoria } from "@/actions/categorias";

interface Mapping {
  woo_cat_id: number;
  woo_cat_name: string | null;
  categoria: string;
  subcategoria: string;
}

export function GestionCategorias({ mappings }: { mappings: Mapping[] }) {
  const [lista, setLista] = useState<Mapping[]>(mappings);
  const [isPending, startTransition] = useTransition();
  const [nuevoId, setNuevoId] = useState("");
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoCat, setNuevoCat] = useState("peluqueria");
  const [nuevoSubcat, setNuevoSubcat] = useState("peluqueria-general");
  const [msg, setMsg] = useState<string | null>(null);

  const allPairs = getAllCategoriaPairs();
  const categorias = [...new Set(allPairs.map(p => p.categoria))];

  function handleAdd() {
    if (!nuevoId || isNaN(Number(nuevoId))) return;
    setMsg(null);
    startTransition(async () => {
      const res = await guardarMapeoCategoria({
        woo_cat_id: Number(nuevoId),
        woo_cat_name: nuevoNombre || null,
        categoria: nuevoCat,
        subcategoria: nuevoSubcat,
      });
      if (res.error) { setMsg("Error: " + res.error); return; }
      setLista(prev => {
        const filtered = prev.filter(m => m.woo_cat_id !== Number(nuevoId));
        return [...filtered, { woo_cat_id: Number(nuevoId), woo_cat_name: nuevoNombre || null, categoria: nuevoCat, subcategoria: nuevoSubcat }]
          .sort((a, b) => a.categoria.localeCompare(b.categoria));
      });
      setNuevoId(""); setNuevoNombre(""); setMsg("Guardado.");
    });
  }

  function handleDelete(woo_cat_id: number) {
    startTransition(async () => {
      await eliminarMapeoCategoria(woo_cat_id);
      setLista(prev => prev.filter(m => m.woo_cat_id !== woo_cat_id));
    });
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-light text-neutral-900" style={{ fontFamily: "var(--font-cormorant)" }}>
          Mapeos de categorías WooCommerce
        </h1>
        <p className="text-sm text-neutral-400 mt-1">
          Asocia IDs de categorías de WooCommerce a categorías de Esencia de Belleza. Se usan en el importador.
        </p>
      </div>

      {/* Añadir nuevo */}
      <div className="border border-neutral-200 p-4 space-y-3">
        <h2 className="text-sm font-medium uppercase tracking-widest text-neutral-700">Añadir mapeo</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="text-xs text-neutral-500 block mb-1">ID WooCommerce</label>
            <input type="number" value={nuevoId} onChange={e => setNuevoId(e.target.value)}
              className="w-full border border-neutral-300 px-2 py-1.5 text-sm" placeholder="ej: 1043" />
          </div>
          <div>
            <label className="text-xs text-neutral-500 block mb-1">Nombre (opcional)</label>
            <input type="text" value={nuevoNombre} onChange={e => setNuevoNombre(e.target.value)}
              className="w-full border border-neutral-300 px-2 py-1.5 text-sm" placeholder="ej: AJMAL" />
          </div>
          <div>
            <label className="text-xs text-neutral-500 block mb-1">Categoría</label>
            <select value={nuevoCat} onChange={e => { setNuevoCat(e.target.value); setNuevoSubcat(allPairs.find(p => p.categoria === e.target.value)?.subcategoria ?? ""); }}
              className="w-full border border-neutral-300 px-2 py-1.5 text-sm bg-white">
              {categorias.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-neutral-500 block mb-1">Subcategoría</label>
            <select value={nuevoSubcat} onChange={e => setNuevoSubcat(e.target.value)}
              className="w-full border border-neutral-300 px-2 py-1.5 text-sm bg-white">
              {allPairs.filter(p => p.categoria === nuevoCat).map(p => (
                <option key={p.subcategoria} value={p.subcategoria}>{p.label.split(" › ")[1]}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleAdd} disabled={isPending || !nuevoId}
            className="px-4 py-2 bg-neutral-900 text-white text-xs tracking-widest uppercase hover:bg-neutral-700 disabled:opacity-40 transition-colors">
            Guardar
          </button>
          {msg && <span className="text-xs text-green-700">{msg}</span>}
        </div>
      </div>

      {/* Tabla */}
      <div className="border border-neutral-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-neutral-50 border-b border-neutral-200">
              <th className="px-4 py-2 text-left text-xs uppercase tracking-widest text-neutral-500">ID Woo</th>
              <th className="px-4 py-2 text-left text-xs uppercase tracking-widest text-neutral-500">Nombre WooCommerce</th>
              <th className="px-4 py-2 text-left text-xs uppercase tracking-widest text-neutral-500">Categoría</th>
              <th className="px-4 py-2 text-left text-xs uppercase tracking-widest text-neutral-500">Subcategoría</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {lista.map(m => (
              <tr key={m.woo_cat_id} className="hover:bg-neutral-50">
                <td className="px-4 py-2 font-mono text-xs text-neutral-500">{m.woo_cat_id}</td>
                <td className="px-4 py-2 text-neutral-700">{m.woo_cat_name ?? "—"}</td>
                <td className="px-4 py-2 text-neutral-700">{m.categoria}</td>
                <td className="px-4 py-2 text-neutral-700">{m.subcategoria}</td>
                <td className="px-4 py-2 text-right">
                  <button onClick={() => handleDelete(m.woo_cat_id)} disabled={isPending}
                    className="text-xs text-red-400 hover:text-red-600 disabled:opacity-40">
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
            {lista.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-neutral-400">
                No hay mapeos. Crea el primero arriba.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
