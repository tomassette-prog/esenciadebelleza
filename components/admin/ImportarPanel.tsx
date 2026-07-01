"use client";

import { useState, useTransition } from "react";
import {
  calcularDiff,
  aplicarCambios,
  publicarAprobados,
  type ProductoDiff,
  type DiffGaps,
  type ReviewGroup,
  type SmartApplyResult,
} from "@/actions/importar";
import { getAllCategoriaPairs, type CategoriaPair } from "@/lib/category-suggester";

// ─── Types ─────────────────────────────────────────────────────────────────────

type Fase = "idle" | "diff" | "listo" | "revisando" | "publicando" | "aplicando";

type GroupState = {
  approved: boolean;
  overrideCategoria?: string;
  overrideSubcategoria?: string;
};

// ─── Pure helpers (outside component) ─────────────────────────────────────────

function buildReviewGroups(nuevos: ProductoDiff[], gaps: DiffGaps): ReviewGroup[] {
  const unmappedMap = new Map(gaps.unmappedCategories.map(u => [u.wooCatId, u]));
  const groupMap = new Map<string, ReviewGroup>();

  for (const nuevo of nuevos) {
    const unmappedCat = nuevo.wooCategories.map(id => unmappedMap.get(id)).find(Boolean);
    if (!unmappedCat) continue;
    const key = `${unmappedCat.suggestedCategoria}/${unmappedCat.suggestedSubcategoria}`;
    if (!groupMap.has(key)) {
      groupMap.set(key, {
        groupKey: key,
        suggestedCategoria: unmappedCat.suggestedCategoria,
        suggestedSubcategoria: unmappedCat.suggestedSubcategoria,
        confidence: unmappedCat.confidence,
        products: [],
        sourceWooCatIds: [],
      });
    }
    const group = groupMap.get(key)!;
    group.products.push({ slug: nuevo.slug, nombre: nuevo.nombre, wooId: nuevo.wooId, brandName: "" });
    for (const id of nuevo.wooCategories) {
      if (unmappedMap.has(id) && !group.sourceWooCatIds.includes(id)) {
        group.sourceWooCatIds.push(id);
      }
    }
  }

  const order: Record<string, number> = { low: 0, medium: 1, high: 2 };
  return [...groupMap.values()].sort((a, b) => order[a.confidence] - order[b.confidence]);
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ImportarPanel() {
  const [isPending, startTransition] = useTransition();
  const [nuevos, setNuevos]         = useState<ProductoDiff[]>([]);
  const [modificados, setModificados] = useState<ProductoDiff[]>([]);
  const [iguales, setIguales]       = useState<number | null>(null);
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [error, setError]           = useState<string | null>(null);
  const [fase, setFase]             = useState<Fase>("idle");
  const [progreso, setProgreso]     = useState<{ ok: number; total: number } | null>(null);
  const [resumen, setResumen]       = useState<{ ok: number; noEncontrados: string[] } | null>(null);

  // Smart import state
  const [gaps, setGaps]             = useState<DiffGaps>({ newBrands: [], unmappedCategories: [] });
  const [reviewGroups, setReviewGroups] = useState<ReviewGroup[]>([]);
  const [groupApprovals, setGroupApprovals] = useState<Map<string, GroupState>>(new Map());
  const [allPairs]                  = useState<CategoriaPair[]>(() => getAllCategoriaPairs());
  const [smartResult, setSmartResult] = useState<SmartApplyResult | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // ── Handlers ────────────────────────────────────────────────────────────────

  function handleDiff() {
    setError(null);
    setResumen(null);
    setSmartResult(null);
    setFase("diff");
    startTransition(async () => {
      const res = await calcularDiff();
      if (res.error) { setError(res.error); setFase("idle"); return; }
      setNuevos(res.nuevos);
      setModificados(res.modificados);
      setIguales(res.iguales);
      setGaps(res.gaps);
      setSeleccionados(new Set(res.nuevos.map(p => p.slug)));
      setFase("listo");
    });
  }

  function handleRevisar() {
    const groups = buildReviewGroups(nuevos, gaps);
    setReviewGroups(groups);
    const initialApprovals = new Map<string, GroupState>(
      groups.map(g => [g.groupKey, { approved: g.confidence === "high" }])
    );
    setGroupApprovals(initialApprovals);
    // Auto-expand low/medium confidence groups
    setExpandedGroups(new Set(groups.filter(g => g.confidence !== "high").map(g => g.groupKey)));
    setFase("revisando");
  }

  function handlePublicarAprobados() {
    const approvedGroups = [...groupApprovals.entries()]
      .filter(([, state]) => state.approved)
      .map(([groupKey, state]) => {
        const group = reviewGroups.find(g => g.groupKey === groupKey)!;
        return {
          slugsConId: group.products.map(p => ({ slug: p.slug, wooId: p.wooId })),
          categoria: state.overrideCategoria ?? group.suggestedCategoria,
          subcategoria: state.overrideSubcategoria ?? group.suggestedSubcategoria,
        };
      });
    if (!approvedGroups.length) return;
    const total = approvedGroups.reduce((s, g) => s + g.slugsConId.length, 0);
    setProgreso({ ok: 0, total });
    setFase("publicando");
    startTransition(async () => {
      const result = await publicarAprobados({ approvedGroups });
      setSmartResult(result);
      if (result.error) setError(result.error);
      setProgreso(null);
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
      const todosDiff = [...nuevos, ...modificados];
      const slugToWooId = new Map(todosDiff.map(p => [p.slug, p.wooId]));
      const todos = [...seleccionados].map(slug => ({ slug, wooId: slugToWooId.get(slug) ?? 0 }));
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

  // ── Derived ─────────────────────────────────────────────────────────────────

  const approvedCount = [...groupApprovals.values()].filter(s => s.approved)
    .reduce((n, state) => {
      const group = reviewGroups.find(g => groupApprovals.get(g.groupKey) === state);
      return n + (group?.products.length ?? 0);
    }, 0);

  const hasGaps = gaps.newBrands.length > 0 || gaps.unmappedCategories.length > 0;
  const uniqueCategorias = [...new Set(allPairs.map(p => p.categoria))];

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">
      {/* Header */}
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

      {/* Alerts */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
      )}

      {/* Calculating */}
      {fase === "diff" && (
        <div className="text-center py-16 text-neutral-400 text-sm animate-pulse">
          Descargando y comparando {">"}3000 productos… esto tarda ~30 segundos
        </div>
      )}

      {/* ── FASE: LISTO (diff result) ── */}
      {(fase === "listo" || fase === "aplicando" || fase === "publicando") && iguales !== null && (
        <>
          {/* SmartApplyResult */}
          {smartResult && (
            <div className="border border-green-200 bg-green-50 p-3 text-sm space-y-1">
              <p className="font-medium text-green-800">✅ {smartResult.ok} productos publicados</p>
              {smartResult.brandsCreated.length > 0 && (
                <p className="text-green-700">Marcas creadas: {smartResult.brandsCreated.join(", ")}</p>
              )}
              {smartResult.seoTriggered.length > 0 && (
                <p className="text-green-700">SEO generado: {smartResult.seoTriggered.length} productos</p>
              )}
              {smartResult.notFound.length > 0 && (
                <p className="text-amber-700">{smartResult.notFound.length} no encontrados en WooCommerce</p>
              )}
            </div>
          )}

          {/* Classic resumen */}
          {resumen && !smartResult && (
            <div className="space-y-2">
              <div className="p-3 bg-green-50 border border-green-200 text-green-700 text-sm">
                ✅ {resumen.ok} productos actualizados.
                {resumen.noEncontrados.length > 0 && (
                  <span className="ml-2 text-amber-700">{resumen.noEncontrados.length} no encontrados.</span>
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

          {/* Summary cards */}
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

          {/* Gaps banner */}
          {hasGaps && nuevos.length > 0 && (
            <div className="border border-amber-200 bg-amber-50 p-4 flex items-start justify-between gap-4">
              <div className="text-sm text-amber-800 space-y-1">
                <p className="font-medium">Se detectaron elementos que requieren revisión:</p>
                {gaps.newBrands.length > 0 && (
                  <p>• {gaps.newBrands.length} marca{gaps.newBrands.length > 1 ? "s" : ""} nueva{gaps.newBrands.length > 1 ? "s" : ""}: {gaps.newBrands.slice(0, 3).join(", ")}{gaps.newBrands.length > 3 ? "…" : ""}</p>
                )}
                {gaps.unmappedCategories.length > 0 && (
                  <p>• {gaps.unmappedCategories.length} categoría{gaps.unmappedCategories.length > 1 ? "s" : ""} de WooCommerce sin mapear</p>
                )}
              </div>
              <button
                onClick={handleRevisar}
                className="shrink-0 px-4 py-2 bg-amber-700 text-white text-xs tracking-widest uppercase hover:bg-amber-800 transition-colors"
              >
                Revisar y publicar
              </button>
            </div>
          )}

          {/* Action bar (fast path for mapped products) */}
          <div className="flex items-center justify-between gap-4 bg-neutral-50 border border-neutral-200 px-4 py-3">
            <p className="text-sm text-neutral-600">
              <span className="font-medium text-neutral-900">{seleccionados.size}</span> seleccionados para aplicar
            </p>
            <button
              onClick={handleAplicar}
              disabled={!seleccionados.size || fase === "aplicando" || fase === "publicando"}
              className="px-6 py-2 bg-neutral-900 text-white text-xs tracking-widest uppercase hover:bg-neutral-700 disabled:opacity-40 transition-colors"
            >
              {fase === "aplicando" ? "Aplicando…" : `Aplicar ${seleccionados.size} cambios`}
            </button>
          </div>

          {/* Progress bar */}
          {(fase === "aplicando" || fase === "publicando") && progreso && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-neutral-500">
                <span>{fase === "publicando" ? "Publicando…" : "Aplicando cambios…"}</span>
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

          {/* Nuevos list */}
          {nuevos.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-medium text-neutral-900 uppercase tracking-widest">
                  Nuevos ({nuevos.length})
                </h2>
                <div className="flex gap-3">
                  <button onClick={() => selectAll(nuevos)} className="text-xs text-neutral-500 hover:text-neutral-900 underline underline-offset-2">Todos</button>
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

          {/* Modificados list */}
          {modificados.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-medium text-neutral-900 uppercase tracking-widest">
                  Con cambios ({modificados.length})
                </h2>
                <div className="flex gap-3">
                  <button onClick={() => selectAll(modificados)} className="text-xs text-neutral-500 hover:text-neutral-900 underline underline-offset-2">Todos</button>
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
                    </summary>
                    <div className="px-11 pb-3 pt-1 space-y-1">
                      {Object.entries(p.cambios ?? {}).map(([campo, vals]) => (
                        <div key={campo} className="grid grid-cols-[80px_1fr_1fr] gap-2 text-xs">
                          <span className="text-neutral-500 font-medium uppercase tracking-wide">{campo}</span>
                          <span className="text-red-600 bg-red-50 px-2 py-0.5 truncate">{vals.actual ?? "—"}</span>
                          <span className="text-green-700 bg-green-50 px-2 py-0.5 truncate">→ {vals.woo ?? "—"}</span>
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

      {/* ── FASE: REVISANDO ── */}
      {fase === "revisando" && (
        <div className="space-y-6">
          {/* Summary */}
          <div className="border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-600 flex gap-4">
            <span><strong className="text-neutral-900">{nuevos.length}</strong> nuevos</span>
            <span><strong className="text-amber-700">{gaps.newBrands.length}</strong> marcas nuevas</span>
            <span><strong className="text-amber-700">{gaps.unmappedCategories.length}</strong> categorías sin mapear</span>
          </div>

          {/* New brands */}
          {gaps.newBrands.length > 0 && (
            <div className="border border-neutral-200 p-4 space-y-2">
              <p className="text-xs font-medium tracking-widest uppercase text-neutral-500">Nuevas marcas detectadas</p>
              <div className="flex flex-wrap gap-2">
                {gaps.newBrands.map(brand => (
                  <span key={brand} className="inline-flex items-center gap-1.5 px-2.5 py-1 border border-amber-200 bg-amber-50 text-amber-800 text-xs">
                    {brand}
                    <span className="text-amber-500 font-medium">· sin logo</span>
                  </span>
                ))}
              </div>
              <p className="text-xs text-neutral-400">Se crearán automáticamente al publicar. Podrás añadir el logo después.</p>
            </div>
          )}

          {/* Review groups */}
          <div className="space-y-3">
            <h2 className="text-sm font-medium text-neutral-900 uppercase tracking-widest">
              Grupos por categoría sugerida ({reviewGroups.length})
            </h2>
            {reviewGroups.length === 0 && (
              <p className="text-sm text-neutral-400 py-4">No hay grupos con categoría desconocida.</p>
            )}
            {reviewGroups.map(group => {
              const state = groupApprovals.get(group.groupKey) ?? { approved: false };
              const isExpanded = expandedGroups.has(group.groupKey);
              const confidenceColor = group.confidence === "high"
                ? "border-green-200 bg-green-50 text-green-700"
                : group.confidence === "medium"
                  ? "border-amber-200 bg-amber-50 text-amber-700"
                  : "border-red-200 bg-red-50 text-red-700";
              const pairLabel = allPairs.find(
                p => p.categoria === (state.overrideCategoria ?? group.suggestedCategoria) &&
                     p.subcategoria === (state.overrideSubcategoria ?? group.suggestedSubcategoria)
              )?.label ?? `${state.overrideCategoria ?? group.suggestedCategoria} › ${state.overrideSubcategoria ?? group.suggestedSubcategoria}`;

              return (
                <div key={group.groupKey} className={`border ${state.approved ? "border-neutral-300" : "border-neutral-200"} transition-colors`}>
                  {/* Group header */}
                  <div className="flex items-center gap-3 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={state.approved}
                      onChange={e => setGroupApprovals(prev => {
                        const next = new Map(prev);
                        next.set(group.groupKey, { ...state, approved: e.target.checked });
                        return next;
                      })}
                      className="w-4 h-4 accent-neutral-900 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-neutral-800">{pairLabel}</span>
                    </div>
                    <span className={`text-xs px-2 py-0.5 border ${confidenceColor}`}>
                      {group.confidence === "high" ? "ALTA" : group.confidence === "medium" ? "MEDIA" : "BAJA"}
                    </span>
                    <span className="text-xs text-neutral-400">{group.products.length} productos</span>
                    <button
                      onClick={() => setExpandedGroups(prev => {
                        const next = new Set(prev);
                        if (next.has(group.groupKey)) next.delete(group.groupKey);
                        else next.add(group.groupKey);
                        return next;
                      })}
                      className="text-neutral-400 hover:text-neutral-600"
                    >
                      {isExpanded ? "▲" : "▼"}
                    </button>
                  </div>

                  {/* Expanded: override + products */}
                  {isExpanded && (
                    <div className="border-t border-neutral-100 px-4 py-3 space-y-3">
                      {/* Category override */}
                      <div className="flex gap-3 items-center">
                        <span className="text-xs text-neutral-500 w-28 shrink-0">Cambiar categoría:</span>
                        <select
                          value={state.overrideCategoria ?? group.suggestedCategoria}
                          onChange={e => {
                            const newCat = e.target.value;
                            const firstSub = allPairs.find(p => p.categoria === newCat)?.subcategoria ?? "";
                            setGroupApprovals(prev => {
                              const next = new Map(prev);
                              next.set(group.groupKey, { ...state, overrideCategoria: newCat, overrideSubcategoria: firstSub });
                              return next;
                            });
                          }}
                          className="text-xs border border-neutral-200 px-2 py-1 bg-white"
                        >
                          {uniqueCategorias.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                        <select
                          value={state.overrideSubcategoria ?? group.suggestedSubcategoria}
                          onChange={e => {
                            setGroupApprovals(prev => {
                              const next = new Map(prev);
                              next.set(group.groupKey, { ...state, overrideSubcategoria: e.target.value });
                              return next;
                            });
                          }}
                          className="text-xs border border-neutral-200 px-2 py-1 bg-white"
                        >
                          {allPairs
                            .filter(p => p.categoria === (state.overrideCategoria ?? group.suggestedCategoria))
                            .map(p => (
                              <option key={p.subcategoria} value={p.subcategoria}>{p.label.split(" › ")[1]}</option>
                            ))}
                        </select>
                      </div>

                      {/* Product list */}
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        {group.products.slice(0, 10).map(p => (
                          <div key={p.slug} className="text-xs text-neutral-600 py-0.5">{p.nombre}</div>
                        ))}
                        {group.products.length > 10 && (
                          <p className="text-xs text-neutral-400">+ {group.products.length - 10} más</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Bottom action bar */}
          <div className="flex items-center justify-between gap-4 border-t border-neutral-200 pt-4">
            <button
              onClick={() => setFase("listo")}
              className="text-sm text-neutral-500 underline underline-offset-2"
            >
              Volver al diff
            </button>
            <button
              disabled={approvedCount === 0 || isPending}
              onClick={handlePublicarAprobados}
              className="px-6 py-2.5 bg-[#3D2018] text-white text-xs tracking-widest uppercase hover:bg-neutral-900 disabled:opacity-40 transition-colors"
            >
              Publicar {approvedCount > 0 ? `${approvedCount} productos` : "aprobados"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

