"use client";

import { useState, useTransition } from "react";
import { calcularDiff, aplicarCambios, type ProductoDiff } from "@/actions/importar";

export function ImportarPanel() {
  const [isPending, startTransition] = useTransition();
  const [nuevos, setNuevos]       = useState<ProductoDiff[]>([]);
  const [modificados, setModificados] = useState<ProductoDiff[]>([]);
  const [iguales, setIguales]     = useState<number | null>(null);
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [resultado, setResultado] = useState<string | null>(null);
  const [error, setError]         = useState<string | null>(null);
  const [fase, setFase]           = useState<"idle" | "diff" | "listo" | "aplicando">("idle");
  const [progreso, setProgreso]   = useState<{ ok: number; total: number } | null>(null);
  const [resumen, setResumen]     = useState<{ ok: number; noEncontrados: string[] } | null>(null);

  function handleDiff() {
    setError(null);
    setResultado(null);
    setFase("diff");
    startTransition(async () => {
      const res = await calcularDiff();
      if (res.error) { setError(res.error); setFase("idle"); return; }
      setNuevos(res.nuevos);
      setModificados(res.modificados);
      setIguales(res.iguales);
      // Pre-seleccionar todos los nuevos
      setSeleccionados(new Set(res.nuevos.map(p => p.slug)));
      setFase("listo");
    });
  }

  function toggleSlug(slug: string) {
    setSeleccionados(prev => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug); else next.add(slug);
      return next;
    });
  }

  function selectAll(lista: ProductoDiff[]) {
    setSeleccionados(prev => new Set([...prev, ...lista.map(p => p.slug)]));
  }

  function deselectAll(lista: ProductoDiff[]) {
    const rem = new Set(lista.map(p => p.slug));
    setSeleccionados(prev => new Set([...prev].filter(s => !rem.has(s))));
  }

  function handleAplicar() {
    if (!seleccionados.size) return;
    setFase("aplicando");
    setError(null);
    setResumen(null);
    setProgreso({ ok: 0, total: seleccionados.size });
    startTransition(async () => {
      const todos = [...seleccionados];
      const LOTE = 100;
      let totalOk = 0;
      const totalNoEncontrados: string[] = [];
      for (let i = 0; i < todos.length; i += LOTE) {
        const lote = todos.slice(i, i + LOTE);
        const res = await aplicarCambios(lote);
        if (res.error) { setError(res.error); setFase("listo"); setProgreso(null); return; }
        totalOk += res.ok;
        totalNoEncontrados.push(...res.noEncontrados);
        setProgreso({ ok: totalOk, total: seleccionados.size });
      }
      setResumen({ ok: totalOk, noEncontrados: totalNoEncontrados });
      setFase("listo");
      setProgreso(null);
    });
  }

  return (
    <div className="space-y-8">
      {/* Cabecera + botón calcular */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-light text-neutral-900" style={{ fontFamily: "var(--font-cormorant)" }}>
            Sincronización con WooCommerce
          </h1>
          <p className="text-sm text-neutral-400 mt-1">
            Compara el catálogo actual con depeluqueriaproductos.com y elige qué aplicar.
          </p>
        </div>
        <button
          onClick={handleDiff}
          disabled={isPending}
          className="shrink-0 px-6 py-2.5 bg-neutral-900 text-white text-xs tracking-widest uppercase hover:bg-neutral-700 disabled:opacity-50 transition-colors"
        >
          {fase === "diff" ? "Calculando…" : "Calcular diff"}
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
      )}
      {resumen && (
        <div className="space-y-3">
          <div className="p-3 bg-green-50 border border-green-200 text-green-700 text-sm">
            ✅ {resumen.ok} productos actualizados correctamente.
            {resumen.noEncontrados.length > 0 && (
              <span className="ml-2 text-amber-700">
                {resumen.noEncontrados.length} no encontrados en WooCommerce.
              </span>
            )}
          </div>
          {resumen.noEncontrados.length > 0 && (
            <details className="text-xs border border-amber-200 bg-amber-50">
              <summary className="px-3 py-2 cursor-pointer text-amber-700 font-medium">
                Ver slugs no encontrados ({resumen.noEncontrados.length})
              </summary>
              <div className="px-3 pb-3 pt-1 space-y-0.5 max-h-48 overflow-y-auto">
                {resumen.noEncontrados.map(s => (
                  <div key={s} className="font-mono text-amber-800">{s}</div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {fase === "diff" && (
        <div className="text-center py-16 text-neutral-400 text-sm animate-pulse">
          Descargando y comparando {">"}3000 productos… esto tarda ~30 segundos
        </div>
      )}

      {(fase === "listo" || fase === "aplicando") && iguales !== null && (
        <>
          {/* Resumen */}
          <div className="grid grid-cols-3 gap-4">
            <div className="border border-neutral-200 p-4 text-center">
              <p className="text-3xl font-light text-green-700">{nuevos.length}</p>
              <p className="text-xs tracking-widest uppercase text-neutral-500 mt-1">Nuevos</p>
            </div>
            <div className="border border-neutral-200 p-4 text-center">
              <p className="text-3xl font-light text-amber-600">{modificados.length}</p>
              <p className="text-xs tracking-widest uppercase text-neutral-500 mt-1">Con cambios</p>
            </div>
            <div className="border border-neutral-200 p-4 text-center">
              <p className="text-3xl font-light text-neutral-400">{iguales}</p>
              <p className="text-xs tracking-widest uppercase text-neutral-500 mt-1">Sin cambios</p>
            </div>
          </div>

          {/* Barra de acción */}
          <div className="flex items-center justify-between gap-4 bg-neutral-50 border border-neutral-200 px-4 py-3">
            <p className="text-sm text-neutral-600">
              <span className="font-medium text-neutral-900">{seleccionados.size}</span> seleccionados
            </p>
            <button
              onClick={handleAplicar}
              disabled={!seleccionados.size || fase === "aplicando"}
              className="px-6 py-2 bg-neutral-900 text-white text-xs tracking-widest uppercase hover:bg-neutral-700 disabled:opacity-40 transition-colors"
            >
              {fase === "aplicando" ? "Aplicando…" : `Aplicar ${seleccionados.size} cambios`}
            </button>
          </div>

          {/* Barra de progreso */}
          {fase === "aplicando" && progreso && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-neutral-500">
                <span>Aplicando cambios…</span>
                <span>{progreso.ok} / {progreso.total}</span>
              </div>
              <div className="w-full h-1.5 bg-neutral-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-neutral-900 transition-all duration-300"
                  style={{ width: `${Math.round((progreso.ok / progreso.total) * 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* ── Tabla: NUEVOS ── */}
          {nuevos.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-medium text-neutral-900 uppercase tracking-widest">
                  Nuevos ({nuevos.length})
                </h2>
                <div className="flex gap-3">
                  <button onClick={() => selectAll(nuevos)}   className="text-xs text-neutral-500 hover:text-neutral-900 underline underline-offset-2">Todos</button>
                  <button onClick={() => deselectAll(nuevos)} className="text-xs text-neutral-500 hover:text-neutral-900 underline underline-offset-2">Ninguno</button>
                </div>
              </div>
              <div className="border border-neutral-200 divide-y divide-neutral-100">
                {nuevos.map(p => (
                  <label key={p.slug} className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-neutral-50 transition-colors">
                    <input
                      type="checkbox"
                      checked={seleccionados.has(p.slug)}
                      onChange={() => toggleSlug(p.slug)}
                      className="w-4 h-4 accent-neutral-900 shrink-0"
                    />
                    <span className="text-sm text-neutral-800 flex-1">{p.nombre}</span>
                    <span className="text-xs text-neutral-400 font-mono">{p.slug}</span>
                    <span className="text-xs px-2 py-0.5 bg-green-50 text-green-700 border border-green-200">nuevo</span>
                  </label>
                ))}
              </div>
            </section>
          )}

          {/* ── Tabla: MODIFICADOS ── */}
          {modificados.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-medium text-neutral-900 uppercase tracking-widest">
                  Con cambios ({modificados.length})
                </h2>
                <div className="flex gap-3">
                  <button onClick={() => selectAll(modificados)}   className="text-xs text-neutral-500 hover:text-neutral-900 underline underline-offset-2">Todos</button>
                  <button onClick={() => deselectAll(modificados)} className="text-xs text-neutral-500 hover:text-neutral-900 underline underline-offset-2">Ninguno</button>
                </div>
              </div>
              <div className="border border-neutral-200 divide-y divide-neutral-100">
                {modificados.map(p => (
                  <details key={p.slug} className="group">
                    <summary className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-neutral-50 transition-colors list-none">
                      <input
                        type="checkbox"
                        checked={seleccionados.has(p.slug)}
                        onChange={(e) => { e.stopPropagation(); toggleSlug(p.slug); }}
                        onClick={e => e.stopPropagation()}
                        className="w-4 h-4 accent-neutral-900 shrink-0"
                      />
                      <span className="text-sm text-neutral-800 flex-1">{p.nombre}</span>
                      <span className="text-xs text-neutral-400">
                        {Object.keys(p.cambios ?? {}).join(", ")}
                      </span>
                      <span className="text-xs px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200">
                        {Object.keys(p.cambios ?? {}).length} cambio{Object.keys(p.cambios ?? {}).length > 1 ? "s" : ""}
                      </span>
                      <svg className="w-4 h-4 text-neutral-400 group-open:rotate-180 transition-transform shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
                      </svg>
                    </summary>
                    <div className="px-11 pb-3 pt-1 space-y-1">
                      {Object.entries(p.cambios ?? {}).map(([campo, vals]) => (
                        <div key={campo} className="grid grid-cols-[80px_1fr_1fr] gap-2 text-xs">
                          <span className="text-neutral-500 font-medium uppercase tracking-wide">{campo}</span>
                          <span className="text-red-600 bg-red-50 px-2 py-0.5 truncate" title={vals.actual ?? "—"}>{vals.actual ?? "—"}</span>
                          <span className="text-green-700 bg-green-50 px-2 py-0.5 truncate" title={vals.woo ?? "—"}>→ {vals.woo ?? "—"}</span>
                        </div>
                      ))}
                    </div>
                  </details>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
