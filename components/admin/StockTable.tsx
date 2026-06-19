"use client";

import { useRef, useState, useTransition, useCallback } from "react";
import { actualizarStock, actualizarPrecio, importarStockCsv } from "@/actions/stock";
import type { ProductoVariacion, ProductoPadre } from "@/types/producto";

type FilaTabla = ProductoVariacion & {
  producto_nombre: string;
  categoria: string;
  subcategoria: string;
};

interface Props {
  filas: FilaTabla[];
}

// ─── Tabla de stock tipo spreadsheet ─────────────────────────────────────────
export function StockTable({ filas: filasIniciales }: Props) {
  const [filas, setFilas] = useState<FilaTabla[]>(filasIniciales);
  const [filtro, setFiltro] = useState("");
  const [filtroCat, setFiltroCat] = useState("");
  const [filtroSubcat, setFiltroSubcat] = useState("");
  const [isPending, startTransition] = useTransition();
  const [errores, setErrores] = useState<Record<string, string>>({});
  const cellRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  // Listas únicas para los selects
  const categorias = [...new Set(filas.map(f => f.categoria).filter(Boolean))].sort();
  const subcategorias = filtroCat
    ? [...new Set(filas.filter(f => f.categoria === filtroCat).map(f => f.subcategoria).filter(Boolean))].sort()
    : [];

  const filasFiltradas = filas.filter((f) => {
    const textOk = !filtro ||
      f.sku.toLowerCase().includes(filtro.toLowerCase()) ||
      f.producto_nombre.toLowerCase().includes(filtro.toLowerCase()) ||
      f.nombre_variacion.toLowerCase().includes(filtro.toLowerCase());
    const catOk = !filtroCat || f.categoria === filtroCat;
    const subcatOk = !filtroSubcat || f.subcategoria === filtroSubcat;
    return textOk && catOk && subcatOk;
  });

  // Navegar entre celdas con teclas de flecha
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>, rowIdx: number, col: string) => {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        e.preventDefault();
        const nextKey = `${rowIdx + 1}-${col}`;
        cellRefs.current.get(nextKey)?.focus();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const prevKey = `${rowIdx - 1}-${col}`;
        cellRefs.current.get(prevKey)?.focus();
      }
    },
    []
  );

  // Guardar stock al perder foco o pulsar Enter
  const handleStockBlur = useCallback(
    (variacionId: string, value: string) => {
      const num = parseInt(value, 10);
      if (isNaN(num) || num < 0) return;

      startTransition(async () => {
        const res = await actualizarStock(variacionId, num);
        if (!res.ok) {
          setErrores((prev) => ({ ...prev, [variacionId]: res.error ?? "Error" }));
        } else {
          setErrores((prev) => {
            const next = { ...prev };
            delete next[variacionId];
            return next;
          });
          setFilas((prev) =>
            prev.map((f) => (f.id === variacionId ? { ...f, stock: num } : f))
          );
        }
      });
    },
    [startTransition]
  );

  // Guardar precio al perder foco
  const handlePrecioBlur = useCallback(
    (
      variacionId: string,
      campo: "precio_b2c" | "precio_b2b" | "precio_comparar",
      value: string
    ) => {
      const num = parseFloat(value.replace(",", "."));
      if (isNaN(num) || num < 0) return;

      startTransition(async () => {
        const res = await actualizarPrecio(variacionId, campo, num);
        if (!res.ok) {
          setErrores((prev) => ({ ...prev, [`${variacionId}-${campo}`]: res.error ?? "Error" }));
        } else {
          setFilas((prev) =>
            prev.map((f) =>
              f.id === variacionId ? { ...f, [campo]: num } : f
            )
          );
        }
      });
    },
    [startTransition]
  );

  return (
    <div className="space-y-4">
      {/* Barra de filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          placeholder="Buscar por SKU, producto o variación..."
          className="input-clean flex-1 min-w-48"
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
        />
        <select
          className="input-clean text-sm min-w-40"
          value={filtroCat}
          onChange={(e) => { setFiltroCat(e.target.value); setFiltroSubcat(""); }}
        >
          <option value="">Todas las categorías</option>
          {categorias.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        {subcategorias.length > 0 && (
          <select
            className="input-clean text-sm min-w-40"
            value={filtroSubcat}
            onChange={(e) => setFiltroSubcat(e.target.value)}
          >
            <option value="">Todas las subcategorías</option>
            {subcategorias.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
        {(filtro || filtroCat || filtroSubcat) && (
          <button
            onClick={() => { setFiltro(""); setFiltroCat(""); setFiltroSubcat(""); }}
            className="text-xs text-neutral-400 hover:text-neutral-700 transition-colors px-2"
          >
            Limpiar
          </button>
        )}
        <span className="text-xs text-neutral-400 ml-auto">
          {filasFiltradas.length} / {filas.length} referencias
        </span>
        <CsvImporter onImportado={(updates) => {
          setFilas((prev) =>
            prev.map((f) => {
              const u = updates.find((u) => u.sku === f.sku);
              return u ? { ...f, stock: u.stock } : f;
            })
          );
        }} />
        {isPending && (
          <span className="text-xs text-neutral-400 animate-pulse">Guardando...</span>
        )}
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto border border-neutral-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-neutral-50 border-b border-neutral-200">
              <th className="px-4 py-3 text-left text-xs font-medium tracking-widest uppercase text-neutral-500 w-32">
                SKU
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium tracking-widest uppercase text-neutral-500">
                Producto
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium tracking-widest uppercase text-neutral-500">
                Variación
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium tracking-widest uppercase text-neutral-500 w-24">
                Stock
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium tracking-widest uppercase text-neutral-500 w-28">
                P. B2C (€)
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium tracking-widest uppercase text-neutral-500 w-28">
                P. B2B (€)
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium tracking-widest uppercase text-neutral-500 w-32">
                Ubicación
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium tracking-widest uppercase text-neutral-500 w-20">
                Estado
              </th>
            </tr>
          </thead>
          <tbody>
            {filasFiltradas.map((fila, rowIdx) => {
              const stockBajo = fila.stock < fila.stock_minimo;
              const errorId = errores[fila.id];

              return (
                <tr
                  key={fila.id}
                  className={`border-b border-neutral-100 hover:bg-neutral-50 transition-colors ${
                    stockBajo ? "bg-amber-50/40" : ""
                  }`}
                >
                  {/* SKU */}
                  <td className="px-4 py-2 font-mono text-xs text-neutral-500">
                    {fila.sku}
                  </td>

                  {/* Producto */}
                  <td className="px-4 py-2 text-neutral-800 max-w-xs truncate">
                    {fila.producto_nombre}
                  </td>

                  {/* Variación */}
                  <td className="px-4 py-2 text-neutral-600 max-w-xs truncate">
                    {fila.nombre_variacion}
                  </td>

                  {/* Stock — editable inline */}
                  <td className="px-4 py-2 text-right">
                    <input
                      type="number"
                      min={0}
                      defaultValue={fila.stock}
                      ref={(el) => {
                        if (el) cellRefs.current.set(`${rowIdx}-stock`, el);
                        else cellRefs.current.delete(`${rowIdx}-stock`);
                      }}
                      onBlur={(e) => handleStockBlur(fila.id, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleStockBlur(fila.id, (e.target as HTMLInputElement).value);
                          handleKeyDown(e, rowIdx, "stock");
                        } else {
                          handleKeyDown(e, rowIdx, "stock");
                        }
                      }}
                      className={`w-20 text-right px-2 py-1 border text-sm outline-none focus:border-neutral-900 transition-colors ${
                        errorId ? "border-red-400 bg-red-50" : stockBajo ? "border-amber-300" : "border-neutral-200"
                      }`}
                    />
                  </td>

                  {/* Precio B2C */}
                  <td className="px-4 py-2 text-right">
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      defaultValue={fila.precio_b2c}
                      ref={(el) => {
                        if (el) cellRefs.current.set(`${rowIdx}-precio_b2c`, el);
                        else cellRefs.current.delete(`${rowIdx}-precio_b2c`);
                      }}
                      onBlur={(e) => handlePrecioBlur(fila.id, "precio_b2c", e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, rowIdx, "precio_b2c")}
                      className="w-24 text-right px-2 py-1 border border-neutral-200 text-sm outline-none focus:border-neutral-900 transition-colors"
                    />
                  </td>

                  {/* Precio B2B */}
                  <td className="px-4 py-2 text-right">
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      defaultValue={fila.precio_b2b ?? ""}
                      ref={(el) => {
                        if (el) cellRefs.current.set(`${rowIdx}-precio_b2b`, el);
                        else cellRefs.current.delete(`${rowIdx}-precio_b2b`);
                      }}
                      onBlur={(e) => handlePrecioBlur(fila.id, "precio_b2b", e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, rowIdx, "precio_b2b")}
                      className="w-24 text-right px-2 py-1 border border-neutral-200 text-sm outline-none focus:border-neutral-900 transition-colors"
                    />
                  </td>

                  {/* Ubicación almacén */}
                  <td className="px-4 py-2 font-mono text-xs text-neutral-400">
                    {fila.ubicacion_almacen ?? "—"}
                  </td>

                  {/* Indicador stock */}
                  <td className="px-4 py-2 text-center">
                    {fila.stock === 0 ? (
                      <span className="inline-block w-2 h-2 rounded-full bg-red-400" title="Sin stock" />
                    ) : stockBajo ? (
                      <span className="inline-block w-2 h-2 rounded-full bg-amber-400" title="Stock bajo" />
                    ) : (
                      <span className="inline-block w-2 h-2 rounded-full bg-green-400" title="Stock OK" />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filasFiltradas.length === 0 && (
          <div className="py-16 text-center text-neutral-400 text-sm">
            No se encontraron resultados para &quot;{filtro}&quot;
          </div>
        )}
      </div>

      {/* Leyenda */}
      <div className="flex items-center gap-6 text-xs text-neutral-400">
        <span className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-green-400" /> Stock OK
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-amber-400" /> Stock bajo
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-red-400" /> Sin stock
        </span>
        <span className="ml-auto">
          {filasFiltradas.length} de {filas.length} variaciones
        </span>
      </div>
    </div>
  );
}

// ─── Importador CSV ───────────────────────────────────────────────────────────
function CsvImporter({
  onImportado,
}: {
  onImportado: (updates: { sku: string; stock: number }[]) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [resultado, setResultado] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lineas = text.trim().split("\n").slice(1); // saltar cabecera

      const filas = lineas
        .map((linea) => {
          const cols = linea.split(",");
          const sku = cols[0]?.trim();
          const stock = parseInt(cols[1]?.trim() ?? "", 10);
          const ubicacion = cols[2]?.trim();
          return { sku, stock, ubicacion_almacen: ubicacion };
        })
        .filter((f) => f.sku && !isNaN(f.stock));

      startTransition(async () => {
        const res = await importarStockCsv(filas);
        setResultado(
          res.ok
            ? ` ${res.actualizados} referencias actualizadas`
            : ` ${res.errores[0]}`
        );
        if (res.ok) onImportado(filas);
        setTimeout(() => setResultado(null), 4000);
      });
    };
    reader.readAsText(file);
    // Reset input para permitir re-importar el mismo archivo
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="flex items-center gap-2">
      <label className="btn-secondary cursor-pointer text-xs py-2 px-4">
        {isPending ? "Importando..." : "Importar CSV"}
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={handleFile}
          disabled={isPending}
        />
      </label>
      {resultado && (
        <span
          className={`text-xs ${resultado.startsWith("") ? "text-green-600" : "text-red-500"}`}
        >
          {resultado}
        </span>
      )}
    </div>
  );
}
