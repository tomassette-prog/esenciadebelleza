"use client";

import { useFormState, useFormStatus } from "react-dom";
import { crearVariacion, eliminarVariacion } from "@/actions/productos";
import type { ProductoVariacion } from "@/types/producto";
import { useState } from "react";

function SubmitBtn({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary px-4 py-2 text-xs tracking-widest uppercase disabled:opacity-50">
      {pending ? "..." : label}
    </button>
  );
}

function FilaVariacion({ v, onEliminar }: { v: ProductoVariacion; onEliminar: (id: string) => void }) {
  const [editando, setEditando] = useState(false);

  async function handleEliminar() {
    if (!confirm(`¿Eliminar variación "${v.nombre_variacion}"?`)) return;
    const res = await eliminarVariacion(v.id);
    if (res.error) alert(res.error);
    else onEliminar(v.id);
  }

  return (
    <tr className="border-b border-neutral-100 hover:bg-neutral-50">
      <td className="px-3 py-2.5 font-mono text-xs text-neutral-600">{v.sku}</td>
      <td className="px-3 py-2.5 text-sm">{v.nombre_variacion}</td>
      <td className="px-3 py-2.5 text-sm font-medium">{v.precio_b2c.toFixed(2)} €</td>
      <td className="px-3 py-2.5 text-sm text-neutral-500">{v.precio_b2b ? `${v.precio_b2b.toFixed(2)} €` : "—"}</td>
      <td className="px-3 py-2.5 text-sm">
        <span className={v.stock === 0 ? "text-red-600 font-medium" : v.stock < 5 ? "text-amber-600" : ""}>
          {v.stock}
        </span>
      </td>
      <td className="px-3 py-2.5 text-center">
        <span className={`text-xs px-1.5 py-0.5 ${v.activa ? "bg-green-50 text-green-700" : "bg-neutral-100 text-neutral-500"}`}>
          {v.activa ? "Activa" : "Inactiva"}
        </span>
      </td>
      <td className="px-3 py-2.5 text-right">
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => setEditando(!editando)}
            className="text-xs text-neutral-500 hover:text-neutral-800 underline underline-offset-2"
          >
            {editando ? "Cerrar" : "Editar"}
          </button>
          <button
            type="button"
            onClick={handleEliminar}
            className="text-xs text-red-400 hover:text-red-600 transition-colors"
          >
            Eliminar
          </button>
        </div>
        {editando && (
          <div className="mt-2 text-xs text-neutral-400">(edición inline próximamente)</div>
        )}
      </td>
    </tr>
  );
}

export function VariacionesManager({ productoId, variacionesIniciales }: {
  productoId: string;
  variacionesIniciales: ProductoVariacion[];
}) {
  const [variaciones, setVariaciones] = useState(variacionesIniciales);
  const [state, formAction] = useFormState(crearVariacion, null);
  const [abierto, setAbierto] = useState(false);

  function handleEliminar(id: string) {
    setVariaciones((prev) => prev.filter((v) => v.id !== id));
  }

  return (
    <section className="bg-white border border-neutral-200">
      <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
        <h2 className="text-lg font-light text-neutral-900" style={{ fontFamily: "var(--font-cormorant)" }}>
          Variaciones ({variaciones.filter((v) => v.activa).length} activas)
        </h2>
        <button
          type="button"
          onClick={() => setAbierto(!abierto)}
          className="text-xs tracking-widest uppercase text-neutral-600 hover:text-neutral-900 border border-neutral-300 hover:border-neutral-700 px-4 py-2 transition-colors"
        >
          {abierto ? "Cancelar" : "+ Añadir variación"}
        </button>
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-neutral-50 text-xs uppercase tracking-widest text-neutral-500">
              <th className="text-left px-3 py-2">SKU</th>
              <th className="text-left px-3 py-2">Nombre</th>
              <th className="text-left px-3 py-2">Precio B2C</th>
              <th className="text-left px-3 py-2">Precio B2B</th>
              <th className="text-left px-3 py-2">Stock</th>
              <th className="text-center px-3 py-2">Estado</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {variaciones.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-sm text-neutral-400">
                  Sin variaciones. Añade la primera.
                </td>
              </tr>
            )}
            {variaciones.map((v) => (
              <FilaVariacion key={v.id} v={v} onEliminar={handleEliminar} />
            ))}
          </tbody>
        </table>
      </div>

      {/* Formulario nueva variación */}
      {abierto && (
        <form action={formAction} className="border-t border-neutral-200 p-6 space-y-4 bg-neutral-50">
          <input type="hidden" name="producto_padre_id" value={productoId} />

          {state?.error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2">
              {state.error}
            </div>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs uppercase tracking-widest text-neutral-600 mb-1.5">SKU *</label>
              <input type="text" name="sku" required className="input-clean w-full font-mono text-sm" placeholder="REF-002" />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-widest text-neutral-600 mb-1.5">Nombre *</label>
              <input type="text" name="nombre_variacion" required defaultValue="Único" className="input-clean w-full text-sm" placeholder="100ml / Rubio..." />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-widest text-neutral-600 mb-1.5">Precio B2C € *</label>
              <input type="number" name="precio_b2c" required step="0.01" min="0" className="input-clean w-full text-sm" placeholder="9.99" />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-widest text-neutral-600 mb-1.5">Stock</label>
              <input type="number" name="stock" min="0" defaultValue={0} className="input-clean w-full text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs uppercase tracking-widest text-neutral-600 mb-1.5">Precio B2B €</label>
              <input type="number" name="precio_b2b" step="0.01" min="0" className="input-clean w-full text-sm" placeholder="Opcional" />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-widest text-neutral-600 mb-1.5">EAN / Código de barras</label>
              <input type="text" name="ean_code" className="input-clean w-full font-mono text-sm" placeholder="1234567890123" />
            </div>
            <div className="lg:col-span-2">
              <label className="block text-xs uppercase tracking-widest text-neutral-600 mb-1.5">URL imagen variación</label>
              <input type="url" name="imagen_url" className="input-clean w-full text-sm" placeholder="https://..." />
            </div>
          </div>

          <SubmitBtn label="Guardar variación" />
        </form>
      )}
    </section>
  );
}
