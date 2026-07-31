"use client";

import { useState, useMemo, useTransition } from "react";
import Link from "next/link";
import {
  marcarNuevosVerificados,
  actualizarProductoNuevo,
  eliminarProducto,
  eliminarProductos,
  bulkActualizarCategoria,
  bulkActualizarMarca,
  bulkToggleActivo,
  listarMarcasParaSelect,
  type ProductoNuevo,
} from "@/actions/productos-nuevos";
import { sincronizarPrecios, sincronizarTodosPrecios } from "@/actions/sync-precios";

import type { CategoriaPair } from "@/lib/category-suggester";

interface Props {
  initialProductos: ProductoNuevo[];
  clearedAt: string;
  initialError?: string;
  allPairs: CategoriaPair[];
}

type Filtro = "todos" | "sin-imagen" | "sin-precio" | "sin-seo" | "sin-marca" | "otros-general";

export function ProductosNuevosClient({ initialProductos, clearedAt, initialError, allPairs }: Props) {
  const [productos, setProductos] = useState<ProductoNuevo[]>(initialProductos);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [isPending, startTransition] = useTransition();
  const [success, setSuccess] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{ nombre?: string; categoria?: string; subcategoria?: string }>({});
  const [marcas, setMarcas] = useState<Array<{ id: string; nombre: string }>>([]);
  const [showBulkMarca, setShowBulkMarca] = useState(false);
  const [showBulkCategoria, setShowBulkCategoria] = useState(false);
  const [bulkMarcaId, setBulkMarcaId] = useState("");
  const [bulkCategoria, setBulkCategoria] = useState("");
  const [bulkSubcategoria, setBulkSubcategoria] = useState("");

  const clearedDate = clearedAt
    ? new Date(clearedAt).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" })
    : "nunca";

  const categorias = useMemo(() => [...new Set(allPairs.map(p => p.categoria))], [allPairs]);
  const subcategoriasForBulk = useMemo(() => {
    if (!bulkCategoria) return [];
    return allPairs.filter(p => p.categoria === bulkCategoria).map(p => p.subcategoria);
  }, [allPairs, bulkCategoria]);

  const filtered = useMemo(() => {
    switch (filtro) {
      case "sin-imagen": return productos.filter(p => !p.imagen_principal_url);
      case "sin-precio": return productos.filter(p => !p.precio_b2c || p.precio_b2c <= 0);
      case "sin-marca": return productos.filter(p => !p.marca_nombre);
      case "otros-general": return productos.filter(p => p.categoria === "otros" && p.subcategoria === "general");
      default: return productos;
    }
  }, [productos, filtro]);

  const allFilteredSelected = filtered.length > 0 && filtered.every(p => selected.has(p.id));

  function toggleSelectAll() {
    setSelected(allFilteredSelected ? new Set() : new Set(filtered.map(p => p.id)));
  }

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const selectedCount = selected.size;
  const selectedIds = useMemo(() => [...selected], [selected]);

  function clearMessages() { setError(null); setSuccess(null); }

  function handleClear() {
    if (!confirm("¿Marcar todos como verificados? Se ocultarán de esta vista.")) return;
    startTransition(async () => {
      const res = await marcarNuevosVerificados();
      if (res.error) { setError(res.error); return; }
      setProductos([]); setSelected(new Set());
      setSuccess("Todos los productos marcados como verificados");
    });
  }

  function handleSyncPrices() {
    if (!confirm("¿Sincronizar TODOS los precios desde WooCommerce? Esto actualizará precios de TODOS los productos (no solo los nuevos).")) return;
    startTransition(async () => {
      const res = await sincronizarTodosPrecios();
      if (res.error) { setError(res.error); return; }
      setSuccess(`✅ Sincronización completa: ${res.actualizados} precios actualizados de ${res.ok} productos de WooCommerce. Recarga la página para ver los cambios.`);
    });
  }

  function handleDelete(id: string, nombre: string) {
    if (!confirm(`¿Eliminar "${nombre}"? Se volverá a importar en la próxima sincronización.`)) return;
    startTransition(async () => {
      const res = await eliminarProducto(id);
      if (res.error) { setError(res.error); return; }
      setProductos(prev => prev.filter(p => p.id !== id));
      setSelected(prev => { const n = new Set(prev); n.delete(id); return n; });
      setSuccess("Producto eliminado");
    });
  }

  function handleBulkDelete() {
    if (!confirm(`¿Eliminar ${selectedCount} productos? Se volverán a importar en la próxima sincronización.`)) return;
    startTransition(async () => {
      const res = await eliminarProductos(selectedIds);
      if (res.error) { setError(res.error); return; }
      setProductos(prev => prev.filter(p => !selected.has(p.id)));
      setSelected(new Set());
      setSuccess(`${res.ok} productos eliminados`);
    });
  }

  function handleBulkToggleActivo(activo: boolean) {
    startTransition(async () => {
      const res = await bulkToggleActivo(selectedIds, activo);
      if (res.error) { setError(res.error); return; }
      setProductos(prev => prev.map(p => selected.has(p.id) ? { ...p, activo } : p));
      setSelected(new Set());
      setSuccess(`${res.ok} productos ${activo ? "activados" : "desactivados"}`);
    });
  }

  function handleBulkCategoria() {
    if (!bulkCategoria || !bulkSubcategoria) return;
    startTransition(async () => {
      const res = await bulkActualizarCategoria(selectedIds, bulkCategoria, bulkSubcategoria);
      if (res.error) { setError(res.error); return; }
      setProductos(prev => prev.map(p => selected.has(p.id) ? { ...p, categoria: bulkCategoria, subcategoria: bulkSubcategoria } : p));
      setSelected(new Set()); setShowBulkCategoria(false); setBulkCategoria(""); setBulkSubcategoria("");
      setSuccess(`${res.ok} productos actualizados a ${bulkCategoria}/${bulkSubcategoria}`);
    });
  }

  function handleBulkMarca() {
    if (!bulkMarcaId) return;
    const marcaNombre = marcas.find(m => m.id === bulkMarcaId)?.nombre ?? "";
    startTransition(async () => {
      const res = await bulkActualizarMarca(selectedIds, bulkMarcaId);
      if (res.error) { setError(res.error); return; }
      setProductos(prev => prev.map(p => selected.has(p.id) ? { ...p, marca_nombre: marcaNombre } : p));
      setSelected(new Set()); setShowBulkMarca(false); setBulkMarcaId("");
      setSuccess(`${res.ok} productos asignados a ${marcaNombre}`);
    });
  }

  function loadMarcas() {
    if (marcas.length > 0) return;
    startTransition(async () => {
      const res = await listarMarcasParaSelect();
      if (!res.error) setMarcas(res.marcas);
    });
  }

  function startEditing(p: ProductoNuevo) {
    setEditingId(p.id);
    setEditDraft({ nombre: p.nombre, categoria: p.categoria, subcategoria: p.subcategoria ?? "" });
  }

  function cancelEditing() { setEditingId(null); setEditDraft({}); }

  function saveEditing(id: string) {
    startTransition(async () => {
      const res = await actualizarProductoNuevo(id, { nombre: editDraft.nombre, categoria: editDraft.categoria, subcategoria: editDraft.subcategoria });
      if (res.error) { setError(res.error); return; }
      setProductos(prev => prev.map(p => p.id === id ? { ...p, ...editDraft } : p));
      setEditingId(null); setEditDraft({}); setSuccess("Producto actualizado");
    });
  }

  function toggleActivo(id: string, current: boolean) {
    startTransition(async () => {
      const res = await actualizarProductoNuevo(id, { activo: !current });
      if (res.error) { setError(res.error); return; }
      setProductos(prev => prev.map(p => p.id === id ? { ...p, activo: !current } : p));
    });
  }

  const counts = useMemo(() => ({
    todos: productos.length,
    "sin-imagen": productos.filter(p => !p.imagen_principal_url).length,
    "sin-precio": productos.filter(p => !p.precio_b2c || p.precio_b2c <= 0).length,
    "sin-marca": productos.filter(p => !p.marca_nombre).length,
    "otros-general": productos.filter(p => p.categoria === "otros" && p.subcategoria === "general").length,
  }), [productos]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-light text-neutral-900" style={{ fontFamily: "var(--font-cormorant)" }}>Productos Nuevos</h1>
          <p className="text-xs text-neutral-400 mt-1">Importados desde {clearedDate} · <strong>{productos.length}</strong> productos</p>
        </div>
        {productos.length > 0 && (
          <div className="flex gap-2">
            <button onClick={handleSyncPrices} disabled={isPending}
              className="px-5 py-2 bg-blue-700 text-white text-xs tracking-widest uppercase hover:bg-blue-800 disabled:opacity-40 transition-colors">
              🔄 Sincronizar TODOS los precios
            </button>
            <button onClick={handleClear} disabled={isPending}
              className="px-5 py-2 bg-green-700 text-white text-xs tracking-widest uppercase hover:bg-green-800 disabled:opacity-40 transition-colors">
              Marcar como verificados
            </button>
          </div>
        )}
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 text-sm flex justify-between"><span>{error}</span><button onClick={clearMessages} className="text-red-400">✕</button></div>}
      {success && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-2 text-sm flex justify-between"><span>✅ {success}</span><button onClick={clearMessages} className="text-green-400">✕</button></div>}

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {([["todos", "Todos"], ["sin-imagen", `Sin imagen (${counts["sin-imagen"]})`], ["sin-precio", `Sin precio (${counts["sin-precio"]})`], ["sin-marca", `Sin marca (${counts["sin-marca"]})`], ["otros-general", `Otros/General (${counts["otros-general"]})`]] as [Filtro, string][]).map(([key, label]) => (
          <button key={key} onClick={() => { setFiltro(key); setSelected(new Set()); }}
            className={`px-3 py-1.5 text-xs rounded-full transition-colors ${filtro === key ? "bg-[#3D2018] text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Bulk action bar */}
      {selectedCount > 0 && (
        <div className="bg-[#3D2018] text-white px-4 py-3 flex flex-wrap items-center gap-3 text-sm sticky top-0 z-10 shadow-lg">
          <span className="font-medium">{selectedCount} seleccionados</span>
          <div className="w-px h-5 bg-white/20" />
          <button onClick={() => handleBulkToggleActivo(true)} disabled={isPending} className="text-xs hover:underline">✅ Activar</button>
          <button onClick={() => handleBulkToggleActivo(false)} disabled={isPending} className="text-xs hover:underline">⛔ Desactivar</button>
          <div className="w-px h-5 bg-white/20" />
          <button onClick={() => { setShowBulkCategoria(!showBulkCategoria); setShowBulkMarca(false); }} className="text-xs hover:underline">📁 Categoría</button>
          {showBulkCategoria && (
            <span className="flex items-center gap-2">
              <select value={bulkCategoria} onChange={e => { setBulkCategoria(e.target.value); setBulkSubcategoria(""); }} className="text-xs bg-white/10 border border-white/20 px-2 py-1 text-white">
                <option value="">Seleccionar…</option>{categorias.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={bulkSubcategoria} onChange={e => setBulkSubcategoria(e.target.value)} className="text-xs bg-white/10 border border-white/20 px-2 py-1 text-white">
                <option value="">Subcategoría…</option>{subcategoriasForBulk.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <button onClick={handleBulkCategoria} disabled={!bulkCategoria || !bulkSubcategoria || isPending} className="text-xs bg-white/20 px-2 py-1 rounded hover:bg-white/30 disabled:opacity-30">Aplicar</button>
            </span>
          )}
          <button onClick={() => { setShowBulkMarca(!showBulkMarca); setShowBulkCategoria(false); loadMarcas(); }} className="text-xs hover:underline">🏷️ Marca</button>
          {showBulkMarca && (
            <span className="flex items-center gap-2">
              <select value={bulkMarcaId} onChange={e => setBulkMarcaId(e.target.value)} className="text-xs bg-white/10 border border-white/20 px-2 py-1 text-white">
                <option value="">Seleccionar marca…</option>{marcas.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
              </select>
              <button onClick={handleBulkMarca} disabled={!bulkMarcaId || isPending} className="text-xs bg-white/20 px-2 py-1 rounded hover:bg-white/30 disabled:opacity-30">Asignar</button>
            </span>
          )}
          <div className="w-px h-5 bg-white/20" />
          <button onClick={handleBulkDelete} disabled={isPending} className="text-xs text-red-300 hover:text-red-100">🗑️ Eliminar</button>
        </div>
      )}

      {filtered.length === 0 && !error && (
        <div className="border border-neutral-200 bg-white p-12 text-center">
          <p className="text-neutral-400 text-sm">{filtro === "todos" ? "No hay productos nuevos pendientes." : "No hay productos con este filtro."}</p>
          {filtro !== "todos" && <button onClick={() => setFiltro("todos")} className="text-xs text-[#C4857A] underline mt-2">Ver todos</button>}
        </div>
      )}

      {filtered.length > 0 && (
        <div className="bg-white border border-neutral-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-100 text-left text-xs uppercase tracking-wider text-neutral-400">
                <th className="p-3 w-10"><input type="checkbox" checked={allFilteredSelected} onChange={toggleSelectAll} className="cursor-pointer accent-[#3D2018]" /></th>
                <th className="p-3 w-12"></th>
                <th className="p-3">Producto</th>
                <th className="p-3">Categoría</th>
                <th className="p-3">Subcategoría</th>
                <th className="p-3">Marca</th>
                <th className="p-3 text-right">Precio</th>
                <th className="p-3 text-center">Estado</th>
                <th className="p-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id} className={`border-b border-neutral-50 hover:bg-neutral-50 ${selected.has(p.id) ? "bg-amber-50" : ""}`}>
                  <td className="p-3"><input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleSelect(p.id)} className="cursor-pointer accent-[#3D2018]" /></td>
                  <td className="p-3">{p.imagen_principal_url ? <img src={p.imagen_principal_url} alt="" className="w-10 h-10 object-cover rounded" /> : <div className="w-10 h-10 bg-neutral-100 rounded flex items-center justify-center text-neutral-300 text-xs">—</div>}</td>
                  <td className="p-3">{editingId === p.id ? <input value={editDraft.nombre ?? ""} onChange={e => setEditDraft(d => ({ ...d, nombre: e.target.value }))} className="w-full border border-neutral-300 px-2 py-1 text-sm" /> : <Link href={`/admin/productos/${p.id}`} className="text-neutral-900 hover:underline font-medium">{p.nombre}</Link>}</td>
                  <td className="p-3">{editingId === p.id ? <input value={editDraft.categoria ?? ""} onChange={e => setEditDraft(d => ({ ...d, categoria: e.target.value }))} className="w-full border border-neutral-300 px-2 py-1 text-sm" /> : <span className={p.categoria === "otros" ? "text-red-500" : "text-neutral-600"}>{p.categoria}</span>}</td>
                  <td className="p-3">{editingId === p.id ? <input value={editDraft.subcategoria ?? ""} onChange={e => setEditDraft(d => ({ ...d, subcategoria: e.target.value }))} className="w-full border border-neutral-300 px-2 py-1 text-sm" /> : <span className={p.subcategoria === "general" ? "text-red-500" : "text-neutral-600"}>{p.subcategoria || "—"}</span>}</td>
                  <td className="p-3"><span className={p.marca_nombre ? "text-neutral-600" : "text-neutral-300"}>{p.marca_nombre || "—"}</span></td>
                  <td className="p-3 text-right">{p.precio_b2c != null && p.precio_b2c > 0 ? <span>{p.precio_b2c.toFixed(2)}€</span> : <span className="text-red-400">—</span>}</td>
                  <td className="p-3 text-center"><button onClick={() => toggleActivo(p.id, p.activo)} disabled={isPending} className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full ${p.activo ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}><span className={`w-1.5 h-1.5 rounded-full ${p.activo ? "bg-green-500" : "bg-red-500"}`} />{p.activo ? "Activo" : "Inactivo"}</button></td>
                  <td className="p-3 text-right">{editingId === p.id ? <span className="flex items-center justify-end gap-2"><button onClick={() => saveEditing(p.id)} disabled={isPending} className="text-xs text-green-700 hover:underline">Guardar</button><button onClick={cancelEditing} className="text-xs text-neutral-400 hover:underline">Cancelar</button></span> : <span className="flex items-center justify-end gap-2"><button onClick={() => startEditing(p)} className="text-xs text-[#C4857A] hover:underline">Editar</button><button onClick={() => handleDelete(p.id, p.nombre)} className="text-xs text-red-400 hover:text-red-600 hover:underline">Eliminar</button></span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
