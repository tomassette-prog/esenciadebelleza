"use client";

import { useState, useTransition, useEffect } from "react";
import { obtenerSubcategorias, crearSubcategoria, actualizarSubcategoria, eliminarSubcategoria, type Subcategoria } from "@/actions/categorias";

const CATEGORIAS = ["peluqueria", "estetica", "barberia", "perfumeria"];

export function GestionSubcategorias() {
  const [lista, setLista] = useState<Subcategoria[]>([]);
  const [isPending, startTransition] = useTransition();
  const [categoriaFiltro, setCategoriaFiltro] = useState("peluqueria");
  
  // Form para crear
  const [nuevoSlug, setNuevoSlug] = useState("");
  const [nuevoLabel, setNuevoLabel] = useState("");
  const [nuevoColumna, setNuevoColumna] = useState("");
  const [nuevoOrden, setNuevoOrden] = useState("1");
  const [nuevoSeoTitle, setNuevoSeoTitle] = useState("");
  const [nuevoSeoDesc, setNuevoSeoDesc] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  
  // Form para editar
  const [editId, setEditId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editColumna, setEditColumna] = useState("");
  const [editOrden, setEditOrden] = useState("");
  const [editSeoTitle, setEditSeoTitle] = useState("");
  const [editSeoDesc, setEditSeoDesc] = useState("");
  const [editActiva, setEditActiva] = useState(true);

  // Cargar subcategorías al cambiar filtro
  useEffect(() => {
    setMsg(null);
    startTransition(async () => {
      const res = await obtenerSubcategorias(categoriaFiltro);
      if (res.error) {
        setMsg("Error al cargar: " + res.error);
        setLista([]);
      } else {
        setLista(res.data || []);
      }
    });
  }, [categoriaFiltro]);

  function handleAdd() {
    if (!nuevoSlug || !nuevoLabel) {
      setMsg("Slug y Label son obligatorios");
      return;
    }
    setMsg(null);
    startTransition(async () => {
      const res = await crearSubcategoria({
        categoria: categoriaFiltro,
        slug: nuevoSlug,
        label: nuevoLabel,
        columna: nuevoColumna || null,
        orden: parseInt(nuevoOrden) || 1,
        seo_title: nuevoSeoTitle || null,
        seo_description: nuevoSeoDesc || null,
      });
      if (res.error) {
        setMsg("Error: " + res.error);
        return;
      }
      setLista(prev => [...prev, res.data!].sort((a, b) => a.orden - b.orden));
      setNuevoSlug("");
      setNuevoLabel("");
      setNuevoColumna("");
      setNuevoOrden("1");
      setNuevoSeoTitle("");
      setNuevoSeoDesc("");
      setMsg("✓ Subcategoría creada");
    });
  }

  function handleEdit(sub: Subcategoria) {
    setEditId(sub.id);
    setEditLabel(sub.label);
    setEditColumna(sub.columna || "");
    setEditOrden(String(sub.orden));
    setEditSeoTitle(sub.seo_title || "");
    setEditSeoDesc(sub.seo_description || "");
    setEditActiva(sub.activa);
  }

  function handleSaveEdit() {
    if (!editId) return;
    setMsg(null);
    startTransition(async () => {
      const res = await actualizarSubcategoria(editId, {
        label: editLabel,
        columna: editColumna || null,
        orden: parseInt(editOrden) || 1,
        seo_title: editSeoTitle || null,
        seo_description: editSeoDesc || null,
        activa: editActiva,
      });
      if (res.error) {
        setMsg("Error: " + res.error);
        return;
      }
      setLista(prev => {
        const updated = prev.map(s => s.id === editId ? res.data! : s);
        return updated.sort((a, b) => a.orden - b.orden);
      });
      setEditId(null);
      setMsg("✓ Subcategoría actualizada");
    });
  }

  function handleCancel() {
    setEditId(null);
  }

  function handleDelete(id: string) {
    if (!confirm("¿Eliminar esta subcategoría?")) return;
    startTransition(async () => {
      const res = await eliminarSubcategoria(id);
      if (res.error) {
        setMsg("Error: " + res.error);
        return;
      }
      setLista(prev => prev.filter(s => s.id !== id));
      setMsg("✓ Subcategoría eliminada");
    });
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-light text-neutral-900" style={{ fontFamily: "var(--font-cormorant)" }}>
          Gestión de Subcategorías
        </h1>
        <p className="text-sm text-neutral-400 mt-1">
          Crea, edita y organiza subcategorías. Incluye SEO (title 60 chars, desc 155 chars).
        </p>
      </div>

      {/* Filtro de categoría */}
      <div className="border border-neutral-200 p-4">
        <label className="text-xs uppercase tracking-widest text-neutral-500 block mb-2">Categoría</label>
        <select
          value={categoriaFiltro}
          onChange={e => setCategoriaFiltro(e.target.value)}
          disabled={isPending}
          className="w-full border border-neutral-300 px-3 py-2 text-sm bg-white"
        >
          {CATEGORIAS.map(c => (
            <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
          ))}
        </select>
      </div>

      {/* Crear nueva */}
      <div className="border border-neutral-200 p-4 space-y-3">
        <h2 className="text-sm font-medium uppercase tracking-widest text-neutral-700">Crear nueva subcategoría</h2>
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
          <div>
            <label className="text-xs text-neutral-500 block mb-1">Slug*</label>
            <input
              type="text"
              value={nuevoSlug}
              onChange={e => setNuevoSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"))}
              placeholder="ej: tintes"
              className="w-full border border-neutral-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-neutral-500 block mb-1">Label*</label>
            <input
              type="text"
              value={nuevoLabel}
              onChange={e => setNuevoLabel(e.target.value)}
              placeholder="ej: Tintes"
              className="w-full border border-neutral-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-neutral-500 block mb-1">Columna</label>
            <input
              type="text"
              value={nuevoColumna}
              onChange={e => setNuevoColumna(e.target.value)}
              placeholder="ej: Coloración"
              className="w-full border border-neutral-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-neutral-500 block mb-1">Orden</label>
            <input
              type="number"
              value={nuevoOrden}
              onChange={e => setNuevoOrden(e.target.value)}
              className="w-full border border-neutral-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-neutral-500 block mb-1">SEO Title (60)</label>
            <input
              type="text"
              value={nuevoSeoTitle}
              onChange={e => setNuevoSeoTitle(e.target.value.slice(0, 60))}
              placeholder="Meta title"
              className="w-full border border-neutral-300 px-2 py-1.5 text-sm text-xs"
            />
            <span className="text-xs text-neutral-400">{nuevoSeoTitle.length}/60</span>
          </div>
          <div>
            <label className="text-xs text-neutral-500 block mb-1">SEO Desc (155)</label>
            <input
              type="text"
              value={nuevoSeoDesc}
              onChange={e => setNuevoSeoDesc(e.target.value.slice(0, 155))}
              placeholder="Meta description"
              className="w-full border border-neutral-300 px-2 py-1.5 text-sm text-xs"
            />
            <span className="text-xs text-neutral-400">{nuevoSeoDesc.length}/155</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleAdd}
            disabled={isPending || !nuevoSlug || !nuevoLabel}
            className="px-4 py-2 bg-neutral-900 text-white text-xs tracking-widest uppercase hover:bg-neutral-700 disabled:opacity-40 transition-colors"
          >
            Crear
          </button>
          {msg && <span className={`text-xs ${msg.startsWith("✓") ? "text-green-700" : "text-red-700"}`}>{msg}</span>}
        </div>
      </div>

      {/* Tabla */}
      <div className="border border-neutral-200 overflow-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-neutral-50 border-b border-neutral-200">
              <th className="px-3 py-2 text-left uppercase tracking-widest text-neutral-500 whitespace-nowrap">Slug</th>
              <th className="px-3 py-2 text-left uppercase tracking-widest text-neutral-500 whitespace-nowrap">Label</th>
              <th className="px-3 py-2 text-left uppercase tracking-widest text-neutral-500 whitespace-nowrap">SEO Title</th>
              <th className="px-3 py-2 text-left uppercase tracking-widest text-neutral-500 whitespace-nowrap">SEO Desc</th>
              <th className="px-3 py-2 text-center uppercase tracking-widest text-neutral-500">Orden</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {lista.map(sub => (
              <tr key={sub.id} className={editId === sub.id ? "bg-blue-50" : "hover:bg-neutral-50"}>
                {editId === sub.id ? (
                  <>
                    <td className="px-3 py-2"><code className="text-xs text-neutral-600">{sub.slug}</code></td>
                    <td className="px-3 py-2">
                      <input type="text" value={editLabel} onChange={e => setEditLabel(e.target.value)} className="w-full border border-neutral-300 px-1 py-0.5 text-xs" />
                    </td>
                    <td className="px-3 py-2">
                      <input type="text" value={editSeoTitle} onChange={e => setEditSeoTitle(e.target.value.slice(0, 60))} maxLength={60} className="w-full border border-neutral-300 px-1 py-0.5 text-xs" />
                      <span className="text-xs text-neutral-400">{editSeoTitle.length}/60</span>
                    </td>
                    <td className="px-3 py-2">
                      <input type="text" value={editSeoDesc} onChange={e => setEditSeoDesc(e.target.value.slice(0, 155))} maxLength={155} className="w-full border border-neutral-300 px-1 py-0.5 text-xs" />
                      <span className="text-xs text-neutral-400">{editSeoDesc.length}/155</span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input type="number" value={editOrden} onChange={e => setEditOrden(e.target.value)} className="w-12 border border-neutral-300 px-1 py-0.5 text-xs text-center" />
                    </td>
                    <td className="px-3 py-2 text-right space-x-2">
                      <button onClick={handleSaveEdit} disabled={isPending} className="text-xs text-green-600 hover:text-green-800 disabled:opacity-40">Guardar</button>
                      <button onClick={handleCancel} disabled={isPending} className="text-xs text-neutral-400 hover:text-neutral-600 disabled:opacity-40">Cancelar</button>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-3 py-2"><code className="text-xs text-neutral-600">{sub.slug}</code></td>
                    <td className="px-3 py-2 text-neutral-700 font-medium">{sub.label}</td>
                    <td className="px-3 py-2 text-neutral-600">{sub.seo_title || "—"}</td>
                    <td className="px-3 py-2 text-neutral-600">{sub.seo_description ? `${sub.seo_description.slice(0, 40)}...` : "—"}</td>
                    <td className="px-3 py-2 text-center text-neutral-600">{sub.orden}</td>
                    <td className="px-3 py-2 text-right space-x-2">
                      <button onClick={() => handleEdit(sub)} disabled={isPending} className="text-xs text-blue-600 hover:text-blue-800 disabled:opacity-40">Editar</button>
                      <button onClick={() => handleDelete(sub.id)} disabled={isPending} className="text-xs text-red-400 hover:text-red-600 disabled:opacity-40">Eliminar</button>
                    </td>
                  </>
                )}
              </tr>
            ))}
            {lista.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-sm text-neutral-400">
                  No hay subcategorías. Crea la primera arriba.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
