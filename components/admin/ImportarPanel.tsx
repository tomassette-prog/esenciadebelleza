"use client";

import { useState, useRef, useEffect } from "react";
import {
  calcularDiff,
  aplicarCambios,
  publicarAprobados,
  listarMarcasExistentes,
  backfillWooId,
  guardarSnapshot,
  type ProductoDiff,
  type DiffGaps,
  type ReviewGroup,
  type SmartApplyResult,
  type MarcaExistente,
  type MarcaResolution,
} from "@/actions/importar";
import type { CategoriaPair } from "@/lib/category-suggester";

// ─── Types ─────────────────────────────────────────────────────────────────────

type Fase = "idle" | "diff" | "listo" | "revisando" | "publicando" | "aplicando";

type Tab = "nuevos" | "precios" | "marcas";

type GroupState = {
  approved: boolean;
  overrideCategoria?: string;
  overrideSubcategoria?: string;
};

type BrandState = {
  approved: boolean;
  isNewBrand: boolean;
  mappingToExisting?: string;
  customBrandName?: string;
};

type ProductOverride = {
  categoria: string;
  subcategoria: string;
  targetGroupKey?: string; // moved to this group
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

// ─── Diff progress helpers ───────────────────────────────────────────────────

function DiffTimer() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <p className="text-xs text-neutral-400 tabular-nums">
      {seconds < 5 ? "Iniciando…" : `${seconds}s transcurridos`}
    </p>
  );
}

function DiffStepIndicator({ label, delay }: { label: string; delay: number }) {
  const [active, setActive] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setActive(true), delay * 1000);
    return () => clearTimeout(id);
  }, [delay]);

  return (
    <div className="flex items-center gap-3">
      <div className="shrink-0 w-5 h-5 flex items-center justify-center">
        {active ? (
          <div className="w-3.5 h-3.5 rounded-full border-2 border-neutral-900 border-t-transparent animate-spin" />
        ) : (
          <div className="w-2 h-2 rounded-full bg-neutral-300" />
        )}
      </div>
      <span className={`text-xs transition-colors duration-500 ${active ? "text-neutral-800" : "text-neutral-400"}`}>
        {label}
      </span>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ImportarPanel({ allPairs }: { allPairs: CategoriaPair[] }) {
  const [nuevos, setNuevos]         = useState<ProductoDiff[]>([]);
  const [modificados, setModificados] = useState<ProductoDiff[]>([]);
  const [iguales, setIguales]       = useState<number | null>(null);
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [error, setError]           = useState<string | null>(null);
  const [fase, setFase]             = useState<Fase>("idle");
  const [progreso, setProgreso]     = useState<{ ok: number; total: number } | null>(null);
  const [resumen, setResumen]       = useState<{ ok: number; noEncontrados: string[]; brandsCreated?: string[]; details?: string[] } | null>(null);

  // Smart import state
  const [gaps, setGaps]             = useState<DiffGaps>({ newBrands: [], unmappedCategories: [], pendingBrands: [] });
  const [reviewGroups, setReviewGroups] = useState<ReviewGroup[]>([]);
  const [groupApprovals, setGroupApprovals] = useState<Map<string, GroupState>>(new Map());
  const [productOverrides, setProductOverrides] = useState<Map<string, ProductOverride>>(new Map());
  const [smartResult, setSmartResult] = useState<SmartApplyResult | null>(null);
  const [publishSuccess, setPublishSuccess] = useState<{ message: string; details: string[] } | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Tab + brand review state
  const [activeTab, setActiveTab] = useState<Tab>("nuevos");
  const [brandApprovals, setBrandApprovals] = useState<Map<string, BrandState>>(new Map());
  const [marcasExistentes, setMarcasExistentes] = useState<MarcaExistente[]>([]);

  // Backfill state
  const [backfillResult, setBackfillResult] = useState<{ ok: number; bySku: number; bySlug: number; byName: number; unmatched: number } | null>(null);
  const [backfillPending, setBackfillPending] = useState(false);
  const backfillRunning = useRef(false);
  const [backfillProgress, setBackfillProgress] = useState<{ phase: string; current: number; total: number } | null>(null);

  // Snapshot state
  const [snapshotResult, setSnapshotResult] = useState<{ ok: number } | null>(null);
  const [snapshotPending, setSnapshotPending] = useState(false);
  const [snapshotExists, setSnapshotExists] = useState<boolean | null>(null);

  // Derived busy flag — use fase instead of isPending to avoid React 18 startTransition + async bug
  // where isPending gets stuck on long-running server actions (>30s)
  const busy = fase === "diff" || fase === "publicando" || fase === "revisando" || fase === "aplicando";

  // ── Handlers ────────────────────────────────────────────────────────────────

  async function handleDiff() {
    setError(null);
    setResumen(null);
    setSmartResult(null);
    setFase("diff");
    try {
      const [res, marcasRes] = await Promise.all([calcularDiff(), listarMarcasExistentes()]);
      if (!res || res.error) { setError(res?.error ?? "Error al calcular diff"); setFase("idle"); return; }
      setNuevos(res.nuevos);
      setModificados(res.modificados);
      setIguales(res.iguales);
      setGaps(res.gaps);
      setSnapshotExists(res.snapshotExists ?? false);
      setMarcasExistentes(marcasRes?.marcas ?? []);
      setBrandApprovals(new Map());
      setProductOverrides(new Map());
      setActiveTab("nuevos");
      setSeleccionados(new Set(res.nuevos.map(p => p.slug)));
      setFase("listo");
    } catch (e) {
      setError(String(e));
      setFase("idle");
    }
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

  async function handlePublicarAprobados() {
    // Build groups, splitting products with individual overrides
    const groupMap = new Map<string, { slugsConId: Array<{ slug: string; wooId: number }>; categoria: string; subcategoria: string }>();

    for (const [groupKey, state] of groupApprovals.entries()) {
      if (!state.approved) continue;
      const group = reviewGroups.find(g => g.groupKey === groupKey);
      if (!group) continue;

      for (const p of group.products) {
        // Check for individual product override
        const override = productOverrides.get(p.slug);
        const cat = override?.categoria ?? state.overrideCategoria ?? group.suggestedCategoria;
        const sub = override?.subcategoria ?? state.overrideSubcategoria ?? group.suggestedSubcategoria;
        const key = `${cat}/${sub}`;

        if (!groupMap.has(key)) {
          groupMap.set(key, { slugsConId: [], categoria: cat, subcategoria: sub });
        }
        groupMap.get(key)!.slugsConId.push({ slug: p.slug, wooId: p.wooId });
      }
    }

    const approvedGroups = [...groupMap.values()];
    const brandMappings = [...brandApprovals.entries()]
      .filter(([, state]) => state.approved)
      .map(([wooBrandName, state]) => ({
        wooBrandName: state.customBrandName || wooBrandName,
        marcaId: state.isNewBrand ? null : (state.mappingToExisting ?? null),
        isNewBrand: state.isNewBrand,
      }));

    // Include ALL selected new products not already in review groups → server auto-resolves category
    const slugsInGroups = new Set(approvedGroups.flatMap(g => g.slugsConId.map(s => s.slug)));
    const autoResolveProducts = nuevos
      .filter(p => seleccionados.has(p.slug) && !slugsInGroups.has(p.slug))
      .map(p => ({ slug: p.slug, wooId: p.wooId }));

    if (!approvedGroups.length && !brandMappings.length && !autoResolveProducts.length) return;
    const total = approvedGroups.reduce((s, g) => s + g.slugsConId.length, 0) + autoResolveProducts.length;
    setProgreso(total > 0 ? { ok: 0, total } : null);
    setFase("publicando");
    try {
      const result = await publicarAprobados({ approvedGroups, brandMappings, autoResolveProducts });
      setSmartResult(result);
      if (result.error) {
        setError(result.error);
      } else {
        // Build success message
        const details: string[] = [];
        if (result.ok > 0) details.push(`${result.ok} productos publicados`);
        if (result.brandsCreated.length > 0) details.push(`Marcas creadas: ${result.brandsCreated.join(", ")}`);
        if (result.seoTriggered.length > 0) details.push(`SEO generado: ${result.seoTriggered.length} productos`);
        if (result.notFound.length > 0) details.push(`${result.notFound.length} no encontrados en WC`);
        setPublishSuccess({ message: `¡${result.ok} productos importados correctamente!`, details });
        
        // Auto-recalcular diff después de publicar
        setTimeout(async () => {
          try {
            const diffRes = await calcularDiff();
            if (!diffRes.error) {
              setNuevos(diffRes.nuevos);
              setModificados(diffRes.modificados);
              setIguales(diffRes.iguales);
              setGaps(diffRes.gaps);
              setSnapshotExists(diffRes.snapshotExists ?? false);
            }
          } catch { /* ignore */ }
        }, 2000);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setProgreso(null);
      setFase("listo");
    }
  }

  function setBrandAsNew(wooBrandName: string, checked: boolean) {
    setBrandApprovals(prev => {
      const next = new Map(prev);
      if (!checked) { next.delete(wooBrandName); return next; }
      next.set(wooBrandName, { approved: true, isNewBrand: true, mappingToExisting: undefined });
      return next;
    });
  }

  function setBrandMapping(wooBrandName: string, marcaId: string) {
    setBrandApprovals(prev => {
      const next = new Map(prev);
      if (!marcaId) { next.delete(wooBrandName); return next; }
      next.set(wooBrandName, { approved: true, isNewBrand: false, mappingToExisting: marcaId });
      return next;
    });
  }

  function selectAllBrandsAsNew(brands: MarcaResolution[]) {
    setBrandApprovals(prev => {
      const next = new Map(prev);
      for (const b of brands) next.set(b.wooBrandName, { approved: true, isNewBrand: true, mappingToExisting: undefined });
      return next;
    });
  }

  function deselectAllBrands(brands: MarcaResolution[]) {
    setBrandApprovals(prev => {
      const next = new Map(prev);
      for (const b of brands) next.delete(b.wooBrandName);
      return next;
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

  function handleBackfill() {
    if (backfillRunning.current) return;
    backfillRunning.current = true;
    setBackfillPending(true);
    setBackfillResult(null);
    setBackfillProgress({ phase: "Iniciando…", current: 0, total: 0 });
    setError(null);

    // Lanzar backfill
    backfillWooId().then(res => {
      backfillRunning.current = false;
      if (res.error) setError(res.error);
      setBackfillResult({ ok: res.ok, bySku: res.bySku, bySlug: res.bySlug, byName: res.byName, unmatched: res.unmatched });
      setBackfillProgress(null);
      setBackfillPending(false);
    }).catch(e => {
      backfillRunning.current = false;
      setError(String(e));
      setBackfillProgress(null);
      setBackfillPending(false);
    });

    // Polling via API route (cada 2s)
    const poll = setInterval(async () => {
      if (!backfillRunning.current) { clearInterval(poll); return; }
      try {
        const res = await fetch("/api/backfill-progress");
        const prog = await res.json();
        if (prog.done) {
          clearInterval(poll);
          return;
        }
        setBackfillProgress({ phase: prog.phase, current: prog.current, total: prog.total });
      } catch { /* ignore */ }
    }, 2000);
  }

  function handleSnapshot() {
    setSnapshotPending(true);
    setSnapshotResult(null);
    setError(null);
    guardarSnapshot().then(res => {
      if (res.error) { setError(res.error); }
      setSnapshotResult({ ok: res.ok });
      setSnapshotPending(false);
    }).catch(() => { setSnapshotPending(false); });
  }

  async function handleAplicar() {
    if (!seleccionados.size) return;
    setFase("aplicando");
    setError(null);
    setResumen(null);
    setProgreso({ ok: 0, total: seleccionados.size });
    try {
      const todosDiff = [...nuevos, ...modificados];
      const slugToWooId = new Map(todosDiff.map(p => [p.slug, p.wooId]));
      const todos = [...seleccionados].map(slug => ({ slug, wooId: slugToWooId.get(slug) ?? 0 }));

      // Build brand overrides from UI state (approved brands from Marcas tab)
      const brandOverrides = [...brandApprovals.entries()]
        .filter(([, state]) => state.approved)
        .map(([wooBrandName, state]) => ({
          wooBrandName,
          marcaId: state.isNewBrand ? null : (state.mappingToExisting ?? null),
          isNewBrand: state.isNewBrand,
          customBrandName: state.customBrandName,
        }));

      const LOTE = 25;
      let totalOk = 0;
      const totalNoEncontrados: string[] = [];
      const allBrandsCreated: string[] = [];
      for (let i = 0; i < todos.length; i += LOTE) {
        const lote = todos.slice(i, i + LOTE);
        const res = await aplicarCambios(lote, brandOverrides.length > 0 ? brandOverrides : undefined);
        if (res.error) { setError(res.error); setFase("listo"); setProgreso(null); return; }
        totalOk += res.ok;
        totalNoEncontrados.push(...res.noEncontrados);
        allBrandsCreated.push(...(res.brandsCreated ?? []));
        setProgreso({ ok: totalOk, total: seleccionados.size });
      }
      const details: string[] = [];
      if (totalOk > 0) details.push(`${totalOk} productos procesados`);
      if (allBrandsCreated.length > 0) details.push(`Marcas creadas: ${allBrandsCreated.join(", ")}`);
      setResumen({ ok: totalOk, noEncontrados: totalNoEncontrados, brandsCreated: allBrandsCreated, details });
    } finally {
      setFase("listo");
      setProgreso(null);
    }
  }

  // ── Derived ─────────────────────────────────────────────────────────────────

  const approvedCount = [...groupApprovals.values()].filter(s => s.approved)
    .reduce((n, state) => {
      const group = reviewGroups.find(g => groupApprovals.get(g.groupKey) === state);
      return n + (group?.products.length ?? 0);
    }, 0);

  const hasGaps = gaps.newBrands.length > 0 || gaps.unmappedCategories.length > 0 || gaps.pendingBrands.length > 0;
  const uniqueCategorias = [...new Set(allPairs.map(p => p.categoria))];
  const brandApprovalCount = [...brandApprovals.values()].filter(s => s.approved).length;

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
          disabled={busy}
          className="shrink-0 px-6 py-2.5 bg-neutral-900 text-white text-xs tracking-widest uppercase hover:bg-neutral-700 disabled:opacity-50 transition-colors"
        >
          {fase === "diff" ? "Calculando…" : "Calcular diff"}
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
      )}
      {publishSuccess && (
        <div className="p-4 bg-green-50 border-2 border-green-400 rounded-lg">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-bold text-green-800">✅ {publishSuccess.message}</p>
              {publishSuccess.details.map((d, i) => (
                <p key={i} className="text-sm text-green-700 mt-1">• {d}</p>
              ))}
            </div>
            <button onClick={() => setPublishSuccess(null)} className="text-green-600 hover:text-green-800 text-lg font-bold">×</button>
          </div>
        </div>
      )}

      {/* Backfill woo_id — only show if no diff has been run yet */}
      {fase === "idle" && (
        <div className="border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-amber-800">Vincular IDs de WooCommerce</p>
              <p className="text-xs text-amber-600 mt-0.5">
                Si es la primera vez que usas el sistema de importación, ejecuta esto antes de &ldquo;Calcular diff&rdquo; para vincular los productos existentes con sus IDs de WooCommerce.
              </p>
            </div>
            <button
              onClick={handleBackfill}
              disabled={backfillPending}
              className="shrink-0 px-4 py-2 bg-amber-700 text-white text-xs tracking-widest uppercase hover:bg-amber-800 disabled:opacity-50 transition-colors"
            >
              {backfillPending ? "Vinculando…" : "Vincular IDs"}
            </button>
          </div>
          {/* Progress bar */}
          {backfillPending && backfillProgress && (
            <div className="mt-3 space-y-1">
              <div className="flex justify-between text-xs text-amber-700">
                <span>{backfillProgress.phase}</span>
                {backfillProgress.total > 0 && <span>{backfillProgress.current}/{backfillProgress.total}</span>}
              </div>
              <div className="w-full bg-amber-200 rounded-full h-2">
                <div
                  className="bg-amber-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: backfillProgress.total > 0 ? `${Math.min(100, Math.round(backfillProgress.current / backfillProgress.total * 100))}%` : "100%" }}
                />
              </div>
            </div>
          )}
          {backfillResult && (
            <div className="mt-3 p-3 bg-white border border-amber-200 text-xs space-y-1">
              <p className="font-medium text-amber-800">✅ {backfillResult.ok} productos vinculados</p>
              <p className="text-amber-700">Por SKU: {backfillResult.bySku} · Por slug: {backfillResult.bySlug} · Por nombre: {backfillResult.byName}</p>
              {backfillResult.unmatched > 0 && (
                <p className="text-amber-600">⚠️ {backfillResult.unmatched} productos sin match — revisa los logs del servidor</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Snapshot — guardar estado actual de WC */}
      {fase === "idle" && (
        <div className="border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-emerald-800">Snapshot de WooCommerce</p>
              <p className="text-xs text-emerald-600 mt-0.5">
                Guarda el estado actual de precios de WooCommerce para comparación incremental. Ejecutar antes de &ldquo;Calcular diff&rdquo;.
              </p>
            </div>
            <button
              onClick={handleSnapshot}
              disabled={snapshotPending}
              className="shrink-0 px-4 py-2 bg-emerald-700 text-white text-xs tracking-widest uppercase hover:bg-emerald-800 disabled:opacity-50 transition-colors"
            >
              {snapshotPending ? "Guardando…" : "Guardar snapshot"}
            </button>
          </div>
          {snapshotResult && (
            <div className="mt-3 p-3 bg-white border border-emerald-200 text-xs">
              <p className="font-medium text-emerald-800">✅ Snapshot guardado: {snapshotResult.ok} productos</p>
            </div>
          )}
        </div>
      )}

      {/* Calculating — enhanced progress indicator */}
      {fase === "diff" && (
        <div className="py-12 space-y-6">
          {/* Spinner + timer */}
          <div className="flex flex-col items-center gap-4">
            <div className="relative w-12 h-12">
              <div className="absolute inset-0 rounded-full border-2 border-neutral-200" />
              <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-neutral-900 animate-spin" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-sm font-medium text-neutral-800">Comparando catálogo con WooCommerce</p>
              <DiffTimer />
            </div>
          </div>

          {/* Step progress */}
          <div className="max-w-md mx-auto space-y-3">
            <DiffStepIndicator label="Descargando productos de WooCommerce" delay={0} />
            <DiffStepIndicator label="Cargando catálogo de Supabase" delay={8} />
            <DiffStepIndicator label="Comparando y generando diff" delay={16} />
          </div>
        </div>
      )}

      {/* ── FASE: LISTO (diff result) ── */}
      {(fase === "listo" || fase === "aplicando" || fase === "publicando") && iguales !== null && (
        <>
          {/* Snapshot warning */}
          {snapshotExists === false && (
            <div className="border border-amber-300 bg-amber-50 p-3 text-sm">
              <p className="font-medium text-amber-800">⚠️ No hay snapshot previo</p>
              <p className="text-amber-700 text-xs mt-1">
                Todos los productos aparecen como nuevos porque no se ha ejecutado &ldquo;Guardar snapshot&rdquo; antes. 
                Tras importar, el snapshot se guardará automáticamente para la próxima comparación.
              </p>
            </div>
          )}

          {/* SmartApplyResult */}
          {/* SmartApplyResult — always visible at top */}
          {smartResult && (
            <div className="border-2 border-green-400 bg-green-50 p-4 text-sm space-y-2 rounded-lg">
              <p className="font-bold text-green-800 text-base">✅ ¡Importación completada!</p>
              <p className="text-green-700">
                <strong>{smartResult.ok}</strong> productos publicados correctamente.
              </p>
              {smartResult.brandsCreated.length > 0 && (
                <p className="text-green-700">🏷️ Marcas creadas: {smartResult.brandsCreated.join(", ")}</p>
              )}
              {smartResult.seoTriggered.length > 0 && (
                <p className="text-green-700">📝 SEO generado para {smartResult.seoTriggered.length} productos</p>
              )}
              {smartResult.notFound.length > 0 && (
                <p className="text-amber-700">⚠️ {smartResult.notFound.length} no encontrados en WooCommerce</p>
              )}
              <div className="pt-2">
                <button
                  onClick={() => { setSmartResult(null); setNuevos([]); setModificados([]); setIguales(null); setFase("idle"); }}
                  className="text-xs text-green-600 underline underline-offset-2"
                >
                  Cerrar y volver al inicio
                </button>
              </div>
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
              {resumen.brandsCreated && resumen.brandsCreated.length > 0 && (
                <div className="p-3 bg-blue-50 border border-blue-200 text-blue-700 text-sm">
                  🏷️ Marcas creadas: {resumen.brandsCreated.join(", ")}
                </div>
              )}
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
                  <p>• {gaps.newBrands.length} marca{gaps.newBrands.length > 1 ? "s" : ""} confirmada{gaps.newBrands.length > 1 ? "s" : ""} como nueva{gaps.newBrands.length > 1 ? "s" : ""}: {gaps.newBrands.slice(0, 3).map(b => b.wooBrandName).join(", ")}{gaps.newBrands.length > 3 ? "…" : ""}</p>
                )}
                {gaps.pendingBrands.length > 0 && (
                  <p>• {gaps.pendingBrands.length} marca{gaps.pendingBrands.length > 1 ? "s" : ""} pendiente{gaps.pendingBrands.length > 1 ? "s" : ""} de decisión — revisar en la pestaña Marcas</p>
                )}
                {gaps.unmappedCategories.length > 0 && (
                  <p>• {gaps.unmappedCategories.length} categoría{gaps.unmappedCategories.length > 1 ? "s" : ""} de WooCommerce sin mapear</p>
                )}
              </div>
              {gaps.unmappedCategories.length > 0 && (
                <button
                  onClick={handleRevisar}
                  className="shrink-0 px-4 py-2 bg-amber-700 text-white text-xs tracking-widest uppercase hover:bg-amber-800 transition-colors"
                >
                  Revisar categorías
                </button>
              )}
            </div>
          )}

          {/* Tab bar */}
          <div className="flex border-b border-neutral-200">
            {(["nuevos", "precios", "marcas"] as Tab[]).map(tab => {
              const counts = { nuevos: nuevos.length, precios: modificados.length, marcas: gaps.pendingBrands?.length ?? 0 };
              const labels = { nuevos: "Nuevos", precios: "Precios", marcas: "Marcas" };
              return (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2.5 text-xs tracking-widest uppercase border-b-2 transition-colors ${
                    activeTab === tab ? "border-neutral-900 text-neutral-900" : "border-transparent text-neutral-400 hover:text-neutral-600"
                  }`}>
                  {labels[tab]} ({counts[tab]})
                </button>
              );
            })}
          </div>

          {/* Action bar (fast path for mapped products) — no aplica a la pestaña Marcas */}
          {activeTab !== "marcas" && (
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
          )}

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

          {/* Tab: Nuevos */}
          {activeTab === "nuevos" && (
            nuevos.length > 0 ? (
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
            ) : (
              <p className="text-sm text-neutral-400 py-8 text-center">No hay productos nuevos.</p>
            )
          )}

          {/* Tab: Precios */}
          {activeTab === "precios" && (
            modificados.length > 0 ? (
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
            ) : (
              <p className="text-sm text-neutral-400 py-8 text-center">No hay cambios de precio.</p>
            )
          )}

          {/* Tab: Marcas */}
          {activeTab === "marcas" && (
            <section className="space-y-4">
              {gaps.pendingBrands.length === 0 ? (
                <p className="text-sm text-neutral-400 py-8 text-center">No hay marcas pendientes de decisión.</p>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-neutral-600">
                      <span className="font-medium text-neutral-900">{brandApprovalCount}</span> de {gaps.pendingBrands.length} marcas con decisión
                    </p>
                    <div className="flex gap-3">
                      <button onClick={() => selectAllBrandsAsNew(gaps.pendingBrands)} className="text-xs text-neutral-500 hover:text-neutral-900 underline underline-offset-2">Marcar todas como nuevas</button>
                      <button onClick={() => deselectAllBrands(gaps.pendingBrands)} className="text-xs text-neutral-500 hover:text-neutral-900 underline underline-offset-2">Ninguno</button>
                    </div>
                  </div>
                  <div className="border border-neutral-200 divide-y divide-neutral-100">
                    {gaps.pendingBrands.map(brand => {
                      const state = brandApprovals.get(brand.wooBrandName);
                      const isNewSelected = !!state?.approved && state.isNewBrand;
                      return (
                        <div key={brand.wooBrandName} className="px-4 py-3 space-y-2">
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <p className="text-sm text-neutral-800 font-medium">{brand.wooBrandName}</p>
                              <p className="text-xs text-neutral-400">
                                {brand.productNames.slice(0, 3).join(", ")}
                                {brand.productCount > 3 ? ` +${brand.productCount - 3} más` : ""}
                              </p>
                            </div>
                            <span className="text-xs text-neutral-400 shrink-0">
                              {brand.productCount} producto{brand.productCount > 1 ? "s" : ""}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => setBrandAsNew(brand.wooBrandName, !isNewSelected)}
                              className={`px-3 py-1.5 text-xs tracking-widest uppercase border transition-colors ${
                                isNewSelected
                                  ? "bg-green-700 border-green-700 text-white"
                                  : "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                              }`}
                            >
                              Marca nueva
                            </button>
                            <span className="text-xs text-neutral-400">o</span>
                            <select
                              value={state && !state.isNewBrand ? state.mappingToExisting ?? "" : ""}
                              onChange={e => setBrandMapping(brand.wooBrandName, e.target.value)}
                              className="text-xs border border-neutral-200 px-2 py-1.5 bg-white flex-1"
                            >
                              <option value="">Mapear a marca existente…</option>
                              {marcasExistentes.map(m => (
                                <option key={m.id} value={m.id}>{m.nombre}</option>
                              ))}
                            </select>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-neutral-400 shrink-0">O escribir marca:</span>
                            <input
                              type="text"
                              placeholder="Ej: Eurostil"
                              className="text-xs border border-neutral-200 px-2 py-1.5 bg-white flex-1"
                              onKeyDown={e => {
                                if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                                  const customName = e.currentTarget.value.trim();
                                  setBrandApprovals(prev => {
                                    const next = new Map(prev);
                                    next.set(brand.wooBrandName, { approved: true, isNewBrand: true, mappingToExisting: undefined, customBrandName: customName });
                                    return next;
                                  });
                                  e.currentTarget.value = '';
                                }
                              }}
                            />
                            {state?.customBrandName && (
                              <span className="text-xs text-green-600 shrink-0">→ {state.customBrandName}</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex justify-end gap-3 items-center">
                    <span className="text-xs text-neutral-400">
                      + {seleccionados.size} productos nuevos seleccionados
                    </span>
                    <button
                      onClick={handlePublicarAprobados}
                      disabled={(brandApprovalCount === 0 && seleccionados.size === 0) || busy}
                      className="px-6 py-2.5 bg-[#3D2018] text-white text-xs tracking-widest uppercase hover:bg-neutral-900 disabled:opacity-40 transition-colors"
                    >
                      Publicar {brandApprovalCount > 0 ? `${brandApprovalCount} marcas` : "marcas"} + {seleccionados.size} productos
                    </button>
                  </div>
                </>
              )}
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
            <span><strong className="text-amber-700">{gaps.newBrands.length}</strong> marcas confirmadas</span>
            <span><strong className="text-amber-700">{gaps.unmappedCategories.length}</strong> categorías sin mapear</span>
          </div>

          {/* New brands */}
          {gaps.newBrands.length > 0 && (
            <div className="border border-neutral-200 p-4 space-y-2">
              <p className="text-xs font-medium tracking-widest uppercase text-neutral-500">Marcas confirmadas como nuevas</p>
              <div className="flex flex-wrap gap-2">
                {gaps.newBrands.map(brand => (
                  <span key={brand.wooBrandName} className="inline-flex items-center gap-1.5 px-2.5 py-1 border border-amber-200 bg-amber-50 text-amber-800 text-xs">
                    {brand.wooBrandName}
                    <span className="text-amber-500 font-medium">· {brand.productCount} producto{brand.productCount > 1 ? "s" : ""}</span>
                  </span>
                ))}
              </div>
              <p className="text-xs text-neutral-400">Ya fueron aprobadas anteriormente en la pestaña Marcas. Se crearán al publicar.</p>
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
                      <div className="space-y-1 max-h-64 overflow-y-auto">
                        {group.products.slice(0, 20).map(p => {
                          const override = productOverrides.get(p.slug);
                          const hasOverride = !!override;
                          return (
                            <div key={p.slug} className={`flex items-center gap-2 py-1 ${hasOverride ? "bg-amber-50 -mx-2 px-2" : ""}`}>
                              <span className="text-xs text-neutral-600 flex-1 truncate">{p.nombre}</span>
                              {hasOverride && (
                                <span className="text-xs text-amber-600 shrink-0">
                                  → {override.categoria} › {override.subcategoria}
                                </span>
                              )}
                              <select
                                value={hasOverride ? `${override.categoria}/${override.subcategoria}` : ""}
                                onChange={e => {
                                  const val = e.target.value;
                                  setProductOverrides(prev => {
                                    const next = new Map(prev);
                                    if (!val) {
                                      next.delete(p.slug);
                                    } else {
                                      const [cat, sub] = val.split("/");
                                      next.set(p.slug, { categoria: cat, subcategoria: sub });
                                    }
                                    return next;
                                  });
                                }}
                                className="text-xs border border-neutral-200 px-1 py-0.5 bg-white w-40 shrink-0"
                              >
                                <option value="">Por defecto</option>
                                {allPairs.map(pair => (
                                  <option key={`${pair.categoria}/${pair.subcategoria}`} value={`${pair.categoria}/${pair.subcategoria}`}>
                                    {pair.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          );
                        })}
                        {group.products.length > 20 && (
                          <p className="text-xs text-neutral-400">+ {group.products.length - 20} más</p>
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
              disabled={approvedCount === 0 || busy}
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

