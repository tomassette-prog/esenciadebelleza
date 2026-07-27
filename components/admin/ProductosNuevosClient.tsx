"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  marcarNuevosVerificados,
  actualizarProductoNuevo,
  type ProductoNuevo,
} from "@/actions/productos-nuevos";

interface Props {
  initialProductos: ProductoNuevo[];
  clearedAt: string;
  initialError?: string;
}

export function ProductosNuevosClient({ initialProductos, clearedAt, initialError }: Props) {
  const [productos, setProductos] = useState<ProductoNuevo[]>(initialProductos);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [isPending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{ nombre?: string; categoria?: string; subcategoria?: string }>({});
  const [success, setSuccess] = useState<string | null>(null);

  const clearedDate = clearedAt ? new Date(clearedAt).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "nunca";

  function handleClear() {
    if (!confirm("¿Marcar todos como verificados? Se ocultarán de esta vista.")) return;
    startTransition(async () => {
      const res = await marcarNuevosVerificados();
      if (res.error) { setError(res.error); return; }
      setProductos([]);
      setSuccess("Todos los productos marcados como verificados");
    });
  }

  function startEditing(p: ProductoNuevo) {
    setEditingId(p.id);
    setEditDraft({ nombre: p.nombre, categoria: p.categoria, subcategoria: p.subcategoria ?? "" });
  }

  function cancelEditing() {
    setEditingId(null);
    setEditDraft({});
  }

  function saveEditing(id: string) {
    startTransition(async () => {
      const res = await actualizarProductoNuevo(id, {
        nombre: editDraft.nombre,
        categoria: editDraft.categoria,
        subcategoria: editDraft.subcategoria,
      });
      if (res.error) { setError(res.error); return; }
      setProductos(prev => prev.map(p => p.id === id ? { ...p, ...editDraft } : p));
      setEditingId(null);
      setEditDraft({});
      setSuccess("Producto actualizado");
    });
  }

  function toggleActivo(id: string, current: boolean) {
    startTransition(async () => {
      const res = await actualizarProductoNuevo(id, { activo: !current });
      if (res.error) { setError(res.error); return; }
      setProductos(prev => prev.map(p => p.id === id ? { ...p, activo: !current } : p));
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-light text-neutral-900" style={{ fontFamily: "var(--font-cormorant)" }}>
            Productos Nuevos
          </h1>
          <p className="text-sm text-neutral-400 mt-1">
            Productos importados desde {clearedDate}. Revisa y edita antes de verificar.
          </p>
        </div>
        {productos.length > 0 && (
          <button
            onClick={handleClear}
            disabled={isPending}
            className="px-6 py-2.5 bg-green-700 text-white text-xs tracking-widest uppercase hover:bg-green-800 disabled:opacity-40 transition-colors"
          >
            {isPending ? "Procesando…" : "Marcar como verificados"}
          </button>
        )}
      </div>

      {/* Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">× cerrar</button>
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 text-sm">
          ✅ {success}
          <button onClick={() => setSuccess(null)} className="ml-2 underline">× cerrar</button>
        </div>
      )}

      {/* Count */}
      <div className="text-sm text-neutral-500">
        <strong className="text-neutral-900">{productos.length}</strong> productos nuevos
      </div>

      {/* Empty state */}
      {productos.length === 0 && !error && (
        <div className="border border-neutral-200 bg-white p-12 text-center">
          <p className="text-neutral-400 text-sm">No hay productos nuevos pendientes de revisión.</p>
          <Link href="/admin/importar" className="text-xs text-[#C4857A] underline mt-2 inline-block">
            Ir a Importar →
          </Link>
        </div>
      )}

      {/* Table */}
      {productos.length > 0 && (
        <div className="bg-white border border-neutral-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-100 text-left text-xs uppercase tracking-wider text-neutral-400">
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
              {productos.map(p => (
                <tr key={p.id} className="border-b border-neutral-50 hover:bg-neutral-50 transition-colors">
                  {/* Image */}
                  <td className="p-3">
                    {p.imagen_principal_url ? (
                      <img src={p.imagen_principal_url} alt="" className="w-10 h-10 object-cover rounded" />
                    ) : (
                      <div className="w-10 h-10 bg-neutral-100 rounded" />
                    )}
                  </td>

                  {/* Nombre */}
                  <td className="p-3">
                    {editingId === p.id ? (
                      <input
                        value={editDraft.nombre ?? ""}
                        onChange={e => setEditDraft(d => ({ ...d, nombre: e.target.value }))}
                        className="w-full border border-neutral-300 px-2 py-1 text-sm"
                      />
                    ) : (
                      <div>
                        <Link href={`/admin/productos/${p.id}`} className="text-neutral-900 hover:underline font-medium">
                          {p.nombre}
                        </Link>
                        {p.sku && <span className="text-xs text-neutral-400 ml-2">{p.sku}</span>}
                      </div>
                    )}
                  </td>

                  {/* Categoría */}
                  <td className="p-3">
                    {editingId === p.id ? (
                      <input
                        value={editDraft.categoria ?? ""}
                        onChange={e => setEditDraft(d => ({ ...d, categoria: e.target.value }))}
                        className="w-full border border-neutral-300 px-2 py-1 text-sm"
                      />
                    ) : (
                      <span className="text-neutral-600">{p.categoria}</span>
                    )}
                  </td>

                  {/* Subcategoría */}
                  <td className="p-3">
                    {editingId === p.id ? (
                      <input
                        value={editDraft.subcategoria ?? ""}
                        onChange={e => setEditDraft(d => ({ ...d, subcategoria: e.target.value }))}
                        className="w-full border border-neutral-300 px-2 py-1 text-sm"
                      />
                    ) : (
                      <span className="text-neutral-600">{p.subcategoria || "—"}</span>
                    )}
                  </td>

                  {/* Marca */}
                  <td className="p-3">
                    <span className="text-neutral-600">{p.marca_nombre || "—"}</span>
                  </td>

                  {/* Precio */}
                  <td className="p-3 text-right">
                    {p.precio_b2c != null ? `${p.precio_b2c.toFixed(2)}€` : "—"}
                  </td>

                  {/* Estado */}
                  <td className="p-3 text-center">
                    <button
                      onClick={() => toggleActivo(p.id, p.activo)}
                      disabled={isPending}
                      className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full transition-colors ${
                        p.activo
                          ? "bg-green-100 text-green-700 hover:bg-green-200"
                          : "bg-red-100 text-red-700 hover:bg-red-200"
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${p.activo ? "bg-green-500" : "bg-red-500"}`} />
                      {p.activo ? "Activo" : "Inactivo"}
                    </button>
                  </td>

                  {/* Acciones */}
                  <td className="p-3 text-right">
                    {editingId === p.id ? (
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => saveEditing(p.id)}
                          disabled={isPending}
                          className="text-xs text-green-700 hover:underline"
                        >
                          Guardar
                        </button>
                        <button onClick={cancelEditing} className="text-xs text-neutral-400 hover:underline">
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => startEditing(p)} className="text-xs text-[#C4857A] hover:underline">
                        Editar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
