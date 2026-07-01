"use client";

import { useState } from "react";
import Link from "next/link";
import { BulkEditBar } from "./BulkEditBar";
import { GenerarSeoBtn } from "./GenerarSeoBtn";

interface ProductoRow {
  id: string;
  nombre: string;
  slug: string;
  categoria: string;
  subcategoria: string | null;
  activo: boolean;
  destacado: boolean;
  nuevo: boolean;
  oferta: boolean;
  imagen_principal_url: string | null;
  marca: { id: string; nombre: string } | { id: string; nombre: string }[] | null;
  variaciones: { id: string; activa: boolean; stock: number; precio_b2c: number }[];
}

interface Props {
  productos: ProductoRow[];
  slugifyCategoria: (s: string) => string;
}

export function ProductosTableClient({ productos, slugifyCategoria }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggleOne(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === productos.length) setSelected(new Set());
    else setSelected(new Set(productos.map(p => p.id)));
  }

  return (
    <>
      <BulkEditBar productoIds={[...selected]} onClear={() => setSelected(new Set())} />
      <div className="bg-white border border-neutral-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50">
                <th className="px-4 py-3 w-8">
                  <input
                    type="checkbox"
                    checked={selected.size === productos.length && productos.length > 0}
                    onChange={toggleAll}
                    className="w-4 h-4 accent-neutral-900"
                  />
                </th>
                <th className="text-left px-4 py-3 font-medium text-neutral-600 text-xs uppercase tracking-widest">Producto</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-600 text-xs uppercase tracking-widest hidden md:table-cell">Categoría</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-600 text-xs uppercase tracking-widest hidden xl:table-cell">URL</th>
                <th className="text-center px-4 py-3 font-medium text-neutral-600 text-xs uppercase tracking-widest">Vars / Stock</th>
                <th className="text-center px-4 py-3 font-medium text-neutral-600 text-xs uppercase tracking-widest">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {productos.map((p) => {
                type MarcaObj = { id: string; nombre: string };
                type VarObj = { activa: boolean; stock: number; precio_b2c: number };
                const marcaObj = (Array.isArray(p.marca) ? p.marca[0] : p.marca) as MarcaObj | null;
                const varsActivas = ((p.variaciones ?? []) as VarObj[]).filter((v) => v.activa);
                const stockTotal = varsActivas.reduce((a, v) => a + (v.stock ?? 0), 0);
                const precioMin = varsActivas.length > 0 ? Math.min(...varsActivas.map((v) => v.precio_b2c ?? 0)) : 0;
                const urlPath = `/productos/${slugifyCategoria(p.categoria)}/${slugifyCategoria(p.subcategoria ?? "general")}/${p.slug}`;
                const isSelected = selected.has(p.id);

                return (
                  <tr key={p.id} className={`transition-colors ${isSelected ? "bg-amber-50" : "hover:bg-neutral-50"}`}>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleOne(p.id)}
                        className="w-4 h-4 accent-neutral-900"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {p.imagen_principal_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.imagen_principal_url} alt="" className="w-10 h-10 object-contain bg-neutral-50 border border-neutral-100 shrink-0" loading="lazy" />
                        ) : (
                          <div className="w-10 h-10 bg-neutral-100 border border-neutral-200 shrink-0" />
                        )}
                        <div>
                          <p className="font-medium text-neutral-900 line-clamp-1">{p.nombre}</p>
                          <p className="text-xs text-neutral-400">{marcaObj?.nombre ?? "Sin marca"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-neutral-600 hidden md:table-cell">
                      <span>{p.categoria}</span>
                      {p.subcategoria && <span className="text-neutral-400"> / {p.subcategoria}</span>}
                    </td>
                    <td className="px-4 py-3 hidden xl:table-cell">
                      <span className="text-xs text-neutral-400 font-mono break-all">{urlPath}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="text-sm font-medium">{varsActivas.length}</div>
                      <div className="text-xs text-neutral-400">
                        {stockTotal > 0 ? `${stockTotal} uds` : "sin stock"}
                        {precioMin > 0 && ` · ${precioMin.toFixed(2)}€`}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block px-2 py-0.5 text-xs ${p.activo ? "bg-green-50 text-green-700 border border-green-200" : "bg-neutral-100 text-neutral-500 border border-neutral-200"}`}>
                        {p.activo ? "Activo" : "Inactivo"}
                      </span>
                      <div className="flex items-center justify-center gap-1 mt-1 flex-wrap">
                        {p.oferta && <span className="inline-block px-1.5 py-0.5 text-[10px] bg-amber-50 text-amber-700 border border-amber-200">Oferta</span>}
                        {p.destacado && <span className="inline-block px-1.5 py-0.5 text-[10px] bg-sky-50 text-sky-700 border border-sky-200">★</span>}
                        {p.nuevo && <span className="inline-block px-1.5 py-0.5 text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200">Nuevo</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <Link href={urlPath} target="_blank" className="text-xs text-neutral-400 hover:text-neutral-700 transition-colors" title="Ver en tienda">↗</Link>
                        <GenerarSeoBtn productoId={p.id} />
                        <Link href={`/admin/productos/${p.id}`} className="text-xs text-neutral-600 hover:text-neutral-900 underline underline-offset-2 transition-colors">Editar</Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {productos.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center text-sm text-neutral-400">
                    No se encontraron productos con los filtros actuales.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
