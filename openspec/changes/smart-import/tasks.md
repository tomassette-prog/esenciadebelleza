# Smart Import — Tasks

## Status
`ready` — produced by sdd-tasks phase

---

## Verification Notes (pre-task)

### WooCommerce `categories` field
**Finding:** In `actions/importar.ts` lines 85–100, the type annotation for WooCommerce products declares:
```ts
categories: { id: number }[];
```
The field `name` is **NOT** included in the declared type. The actual WooCommerce API does return `name`, but the local type only types `id`. **T3 must also update this type annotation** to include `name` so that `calcularDiff()` can read `cat.name` for unmapped category detection.

### `generateSEO` signature
**Finding:** `lib/seo-generator.ts` exports:
```ts
export function generateSEO(input: InputProductoSeo): OutputSeo
```
It is a **synchronous** function returning `OutputSeo` directly (not a Promise). In the design's Step F, `generateSEO(p).then(...)` would fail — it must be called as a sync call and then update Supabase separately. T6 must account for this: call `generateSEO(p)` synchronously to get `OutputSeo`, then `await supa.from("productos_padre").update(seoOutput).eq("slug", p.slug)`. Wrap in `Promise.allSettled` for the whole operation.

---

## Tasks

### T1: Extend WooCommerce category type to include `name`
**File**: `actions/importar.ts`
**Type**: modify
**Depends on**: none
**What to implement**:
In the inline type annotation for `wooProductos` array inside `calcularDiff()`, change:
```ts
categories: { id: number }[];
```
to:
```ts
categories: { id: number; name: string }[];
```
This is a 1-line change. No runtime behavior change — the API already returns `name`; we're just exposing it in the type so later tasks can safely access `cat.name`.

**Acceptance**: TypeScript compiles without errors when accessing `p.categories[0].name` in `calcularDiff()`.

---

### T2: Create `lib/category-suggester.ts`
**File**: `lib/category-suggester.ts`
**Type**: new-file
**Depends on**: none
**What to implement**:
New file with three exports:

1. **`normalize(s: string): string`** — private helper. Lowercases, strips diacritics (NFD + remove `\u0300-\u036f`), replaces non-alphanumeric chars with space, collapses spaces, trims.

2. **`suggestCategory(wooCatName: string, productName: string): CategorySuggestion`**:
   - Import `NAV_ITEMS` from `@/lib/categorias` at module level.
   - Build `ALL_PAIRS: RawPair[]` once at module load from `NAV_ITEMS.flatMap(...)`. Guard with `if (!item.columnas) return []`. Extract `categoria = item.href.split("/")[2]`, `subcategoria = link.href.split("/")[3]`, `tokens = subcategoria.split("-").filter(t => t.length > 2)`.
   - Scoring per pair: exact slug match (hyphens removed) → 100 pts; each token in `normCat` → +60; each token in `normProd` → +30; cap at 100.
   - Tie-break: prefer pair whose `categoria` appears in `normCat`.
   - Confidence: score ≥ 80 → `"high"`, 40–79 → `"medium"`, < 40 → `"low"`.
   - Fallback (score === 0): `{ categoria: "peluqueria", subcategoria: "peluqueria-general", confidence: "low" }`.
   - Export interface `CategorySuggestion { categoria, subcategoria, confidence }`.

3. **`getAllCategoriaPairs(): CategoriaPair[]`**:
   - Same `NAV_ITEMS.flatMap` traversal.
   - Each entry: `{ categoria, subcategoria, label: "${categoriaLabel} › ${link.label}" }`.
   - Export interface `CategoriaPair { categoria, subcategoria, label }`.

**Acceptance**: Calling `suggestCategory("Champús Profesionales", "Wella Shampoo")` returns `{ categoria: "peluqueria", subcategoria: "champus", confidence: "high" }`. Calling `getAllCategoriaPairs()` returns a non-empty array with `label` strings in the form `"X › Y"`.

---

### T3: Extend `ProductoDiff` and populate `wooCategories` in `calcularDiff()`
**File**: `actions/importar.ts`
**Type**: modify
**Depends on**: T1
**What to implement**:
Two changes:

**a) Interface change** — add field to `ProductoDiff`:
```ts
export interface ProductoDiff {
  slug: string;
  nombre: string;
  tipo: "nuevo" | "modificado";
  wooId: number;
  wooCategories: number[];   // ← NEW
  cambios?: Record<string, { woo: string | null; actual: string | null }>;
}
```

**b) `calcularDiff()` — update `nuevos.push(...)` call** to include:
```ts
wooCategories: p.categories.map((c: { id: number; name: string }) => c.id),
```

Also add all five new interfaces as exports at the top of the file (alongside `ProductoDiff`):
- `UnmappedCategory` (fields: `wooCatId`, `wooCatName`, `suggestedCategoria`, `suggestedSubcategoria`, `confidence`)
- `DiffGaps` (fields: `newBrands: string[]`, `unmappedCategories: UnmappedCategory[]`)
- `ReviewGroup` (fields: `groupKey`, `suggestedCategoria`, `suggestedSubcategoria`, `confidence`, `products: Array<{slug, nombre, wooId, brandName}>`, `sourceWooCatIds: number[]`)
- `ReviewPayload` (fields: `approvedGroups: Array<{slugsConId: Array<{slug, wooId}>, categoria, subcategoria}>`)
- `SmartApplyResult` (fields: `ok`, `brandsCreated`, `seoTriggered`, `notFound`, `error?`)

Update `calcularDiff()` return type signature:
```ts
export async function calcularDiff(): Promise<{
  nuevos: ProductoDiff[];
  modificados: ProductoDiff[];
  iguales: number;
  gaps: DiffGaps;
  error?: string;
}>
```

Update the error return to include `gaps: { newBrands: [], unmappedCategories: [] }`.

**Acceptance**: TypeScript compiles. `calcularDiff()` result has a `.gaps` field. Running diff on a live product returns `gaps` (even if empty arrays).

---

### T4: Add `extractBrandName` helper and `detectNewBrands` to `actions/importar.ts`
**File**: `actions/importar.ts`
**Type**: modify
**Depends on**: T3
**What to implement**:
Add two private (non-exported) functions above `calcularDiff`:

**`extractBrandName(productName: string): string`**:
```ts
const DESCRIPTOR_BLOCKLIST = new Set([
  "de", "del", "para", "con", "y", "e", "el", "la", "los", "las",
  "un", "una", "por", "en", "a",
]);

function extractBrandName(productName: string): string {
  const words = productName.trim().replace(/\s+/g, " ").split(" ");
  if (words.length === 0) return productName.trim();
  const first = words[0];
  if (words.length >= 2) {
    const second = words[1];
    const secondIsDescriptor = DESCRIPTOR_BLOCKLIST.has(second.toLowerCase());
    const secondIsShort = second.length <= 12;
    const secondIsCapitalized = /^[A-ZÁÉÍÓÚÑÜ'"]/.test(second);
    if (!secondIsDescriptor && secondIsShort && secondIsCapitalized) {
      return `${first} ${second}`;
    }
  }
  return first;
}
```

**`detectNewBrands(nuevos, wooMap, existingMarcaSlugs)`**:
```ts
function detectNewBrands(
  nuevos: ProductoDiff[],
  wooMap: Map<number, { name: string }>,
  existingMarcaSlugs: Set<string>
): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const nuevo of nuevos) {
    const woo = wooMap.get(nuevo.wooId);
    if (!woo) continue;
    const brandName = extractBrandName(woo.name);
    const brandSlug = slugify(brandName);
    if (!existingMarcaSlugs.has(brandSlug) && !seen.has(brandSlug)) {
      seen.add(brandSlug);
      result.push(brandName);
    }
  }
  return result;
}
```

Note: `slugify` is already used/imported in the file — reuse the same helper.

**Acceptance**: `extractBrandName("Wella Color Charm")` returns `"Wella Color"`. `extractBrandName("Champú de Revlon")` returns `"Champú"`.

---

### T5: Add brand and unmapped-category gap detection to `calcularDiff()`
**File**: `actions/importar.ts`
**Type**: modify
**Depends on**: T2, T3, T4
**What to implement**:
After the existing compare loop (that builds `nuevos[]` and `modificados[]`), add the following block before the `return` statement:

```ts
// Fetch existing marcas slugs
const { data: marcasRows } = await supa.from("marcas").select("slug");
const existingMarcaSlugs = new Set<string>(
  (marcasRows ?? []).map((r: { slug: string }) => r.slug)
);

// Build wooMap keyed by wooId
const wooMap = new Map(wooProductos.map(p => [p.id, { name: p.name }]));

// Detect new brands
const newBrands = detectNewBrands(nuevos, wooMap, existingMarcaSlugs);

// Detect unmapped categories (dynamic import to avoid circular dep risk)
const { suggestCategory } = await import("@/lib/category-suggester");
const seenCatIds = new Set<number>();
const unmappedCategories: UnmappedCategory[] = [];

for (const nuevo of nuevos) {
  for (const catId of nuevo.wooCategories) {
    if (WOO_CAT_MAP[catId] || seenCatIds.has(catId)) continue;
    seenCatIds.add(catId);
    const wooP = wooMap.get(nuevo.wooId);
    const cat = wooProductos
      .find(p => p.id === nuevo.wooId)
      ?.categories.find((c: { id: number; name: string }) => c.id === catId);
    const wooCatName = cat?.name ?? String(catId);
    const suggestion = suggestCategory(wooCatName, nuevo.nombre);
    unmappedCategories.push({
      wooCatId: catId,
      wooCatName,
      suggestedCategoria: suggestion.categoria,
      suggestedSubcategoria: suggestion.subcategoria,
      confidence: suggestion.confidence,
    });
  }
}

const gaps: DiffGaps = { newBrands, unmappedCategories };
```

Update the final return to include `gaps`:
```ts
return { nuevos, modificados, iguales, gaps };
```

**Note on `wooMap`**: since `wooProductos` already holds all fetched products, use `wooProductos.find(p => p.id === nuevo.wooId)` for `cat.name` lookup rather than a second array — the inline wooMap approach above needs the full `wooProductos` reference for category name resolution. Alternatively keep `wooMap` as `Map<number, WooProducto>` (full object) instead of `{ name: string }` only.

**Acceptance**: After running `calcularDiff()` in an environment with unmapped WooCommerce categories, `gaps.unmappedCategories` is non-empty and each entry has a `confidence` value. When all WooCommerce category IDs are in `WOO_CAT_MAP`, `gaps.unmappedCategories` is `[]`.

---

### T6: Implement `publicarAprobados()` server action
**File**: `actions/importar.ts`
**Type**: modify
**Depends on**: T4, T5
**What to implement**:
Add the new exported server action after `calcularDiff`. Full implementation per design §2.5:

**Step A** — `await verificarAdmin()` inside try/catch; return `{ ok: 0, brandsCreated: [], seoTriggered: [], notFound: [], error: "No autorizado" }` on throw.

**Step B** — Collect `allSlugsConId` from `payload.approvedGroups`. Guard: if empty, return early `{ ok: 0, brandsCreated: [], seoTriggered: [], notFound: [] }`. Fetch each product from `fetchWoo(\`/products/${wooId}\`)` with `PARALELO = 20` concurrent requests using the same pattern as `aplicarCambios` (batched `Promise.all`). Track `notFound: string[]` for failed fetches.

**Step C** — Auto-create brands:
- Load `marcas` (id, slug, nombre) → build `marcaSlugToId: Map<string, number>`.
- For each fetched product, extract brand via `extractBrandName(p.name)`, slugify, check map.
- Collect `brandsToInsert[]`. Upsert with `onConflict: "slug", ignoreDuplicates: true`.
- After upsert, re-fetch all marcas to fill in new IDs.
- Collect `brandsCreated: string[]` (names that were inserted).

**Step D** — Build `slugToCat` map from `payload.approvedGroups`. Load existing `destacado`/`nuevo` flags from `productos_padre` for all `publishedSlugs`. Build upsert rows:
- `activo: true` (always publish)
- `categoria`, `subcategoria` from `slugToCat` (override WooCommerce-derived mapping)
- `marca_id` from `marcaSlugToId` by extracting brand slug from product name; `null` if not found
- `seo_title`: `${nombre.slice(0, 60 - " | Esencia de Belleza".length)} | Esencia de Belleza`
- `seo_description`: `Compra ${nombre} al mejor precio. Envío 24-48h a toda España.`
- Preserve `destacado` and `nuevo` from existing rows (default `false`)

Upsert with `onConflict: "slug"`. Return early with error if upsert fails.

**Step E** — Upsert variations: same logic as `aplicarCambios`. For `type === "simple"` products with `sku`, upsert `productos_variaciones` with `onConflict: "sku"`.

**Step F** — Trigger SEO:
- Query `productos_padre` for `publishedSlugs` where `texto_enriquecido_seo IS NULL OR texto_enriquecido_seo = ''`.
- **Important**: `generateSEO` is **synchronous** — it returns `OutputSeo` directly (not a Promise). For each row needing SEO, call `generateSEO({ nombre, marca: null, categoria, subcategoria, descripcion: null })` to get `{ seo_title, seo_description, texto_enriquecido_seo }`, then update the row with the result via `await supa.from("productos_padre").update(seoOutput).eq("slug", slug)`.
- Wrap the whole per-product operation in `Promise.allSettled` for non-blocking error tolerance.
- Collect fulfilled slugs into `seoTriggered`.

**Step G** — Return `{ ok: rows.length, brandsCreated, seoTriggered, notFound }`.

Wrap the entire body (after admin check) in a `try/catch` that returns `{ ok: 0, brandsCreated: [], seoTriggered: [], notFound: [], error: String(e) }`.

**Acceptance**: Calling `publicarAprobados` with a valid `ReviewPayload` upserts the approved products with `activo = true`. Products without SEO get `texto_enriquecido_seo` populated. New brands appear in `marcas` with `logo_url = null`.

---

### T7: Update `ImportarPanel.tsx` — state, types, and diff handler
**File**: `components/admin/ImportarPanel.tsx`
**Type**: modify
**Depends on**: T3, T6
**What to implement**:
**a) Update imports** — add to the `@/actions/importar` import:
```ts
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
import NAV_ITEMS from "@/lib/categorias"; // or named import, match existing usage
```

**b) Extend `Fase` type**:
```ts
type Fase = "idle" | "diff" | "listo" | "revisando" | "publicando" | "done";
```

**c) Add new state variables** (alongside existing `useState` declarations):
```ts
const [gaps, setGaps] = useState<DiffGaps>({ newBrands: [], unmappedCategories: [] });
const [reviewGroups, setReviewGroups] = useState<ReviewGroup[]>([]);
type GroupState = { approved: boolean; overrideCategoria?: string; overrideSubcategoria?: string };
const [groupApprovals, setGroupApprovals] = useState<Map<string, GroupState>>(new Map());
const [allPairs] = useState<CategoriaPair[]>(() => getAllCategoriaPairs());
const [smartResult, setSmartResult] = useState<SmartApplyResult | null>(null);
```

**d) Add module-level `buildReviewGroups` pure function** (outside the component):
```ts
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

  const order = { low: 0, medium: 1, high: 2 };
  return [...groupMap.values()].sort((a, b) => order[a.confidence] - order[b.confidence]);
}
```

**e) Update `handleDiff`** to populate `gaps` and reset new state:
```ts
function handleDiff() {
  setError(null);
  setSmartResult(null);
  setResultado(null);
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
```

**f) Add `handleRevisar`** function:
```ts
function handleRevisar() {
  const groups = buildReviewGroups(nuevos, gaps);
  setReviewGroups(groups);
  const initialApprovals = new Map<string, GroupState>(
    groups.map(g => [g.groupKey, { approved: g.confidence === "high" }])
  );
  setGroupApprovals(initialApprovals);
  setFase("revisando");
}
```

**g) Add `handlePublicarAprobados`** function:
```ts
async function handlePublicarAprobados() {
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
  const totalProducts = approvedGroups.reduce((s, g) => s + g.slugsConId.length, 0);
  setProgreso({ ok: 0, total: totalProducts });
  setFase("publicando");
  startTransition(async () => {
    const result = await publicarAprobados({ approvedGroups });
    setSmartResult(result);
    if (result.error) setError(result.error);
    setProgreso(null);
    setFase("listo");
  });
}
```

**Acceptance**: TypeScript compiles. The component renders without errors. `gaps` and `reviewGroups` state is correctly initialized. `handleDiff` populates `gaps` from the server response.

---

### T8: Implement the review UI in `ImportarPanel.tsx` (`fase === "revisando"`)
**File**: `components/admin/ImportarPanel.tsx`
**Type**: modify
**Depends on**: T7
**What to implement**:
In the JSX return, add a conditional block for `fase === "revisando"`:

**New brands section** (render above groups, only when `gaps.newBrands.length > 0`):
```tsx
<div className="border border-neutral-200 p-4 space-y-2">
  <p className="text-xs font-medium tracking-widest uppercase text-neutral-500">
    Nuevas marcas detectadas
  </p>
  <div className="flex flex-wrap gap-2">
    {gaps.newBrands.map(brand => (
      <span key={brand}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 border border-amber-200
                   bg-amber-50 text-amber-800 text-xs">
        {brand}
        <span className="text-amber-500 font-medium">· sin logo</span>
      </span>
    ))}
  </div>
  <p className="text-xs text-neutral-400">
    Se crearán automáticamente al publicar. Podrás añadir el logo después.
  </p>
</div>
```

**Review groups** — collapsible rows (one per `ReviewGroup`). Each row has:
- Checkbox controlling `groupApprovals.get(groupKey)?.approved`.
- Confidence badge: green/amber/red border (`"high"` → green, `"medium"` → amber, `"low"` → red).
- Category label resolved from `allPairs` (label in `"X › Y"` form); fall back to `"cat/subcat"` if not found.
- Product count badge.
- Expanded body (shown when `confidence !== "high"` OR not approved): category override selects + product list (max 10 items, "+ N más" overflow).

**Category override selects**:
- First `<select>` filters unique `categoria` values from `allPairs`. On change, reset `overrideSubcategoria` to first subcategoria of new categoria.
- Second `<select>` filters `allPairs` by active categoria; option values are `subcategoria` slugs.
- Both call `setGroupApprovals(prev => { const next = new Map(prev); next.set(...); return next; })`.

**Bottom action bar**:
```tsx
<div className="border border-neutral-200 p-3 bg-neutral-50 text-sm text-neutral-600">
  {nuevos.length} nuevos · {gaps.newBrands.length} marcas nuevas · {gaps.unmappedCategories.length} categorías sin mapear
</div>
<div className="flex items-center justify-between gap-4">
  <button onClick={() => setFase("listo")}
    className="text-sm text-neutral-500 underline">
    Volver
  </button>
  <button
    disabled={[...groupApprovals.values()].every(s => !s.approved)}
    onClick={handlePublicarAprobados}
    className="px-4 py-2 bg-[#3D2018] text-white text-sm disabled:opacity-40">
    Publicar aprobados ({[...groupApprovals.values()].filter(s => s.approved)
      .reduce((n, s) => {
        const group = reviewGroups.find(g => groupApprovals.get(g.groupKey) === s);
        return n + (group?.products.length ?? 0);
      }, 0)})
  </button>
</div>
```

**`SmartApplyResult` display** (render in `fase === "listo"` section when `smartResult !== null`):
```tsx
{smartResult && (
  <div className="border border-green-200 bg-green-50 p-3 text-sm space-y-1">
    <p className="font-medium text-green-800">
      {smartResult.ok} productos publicados
    </p>
    {smartResult.brandsCreated.length > 0 && (
      <p className="text-green-700">
        Marcas creadas: {smartResult.brandsCreated.join(", ")}
      </p>
    )}
    {smartResult.seoTriggered.length > 0 && (
      <p className="text-green-700">
        SEO generado: {smartResult.seoTriggered.length} productos
      </p>
    )}
    {smartResult.notFound.length > 0 && (
      <p className="text-amber-700">
        No encontrados en WooCommerce: {smartResult.notFound.join(", ")}
      </p>
    )}
  </div>
)}
```

**Progress bar for `fase === "publicando"`**: re-use existing `progreso` state and progress bar component/markup already present for `"aplicando"` phase. Just ensure `fase === "publicando"` renders it too.

**Acceptance**: Review screen renders all groups. Unchecking all groups disables "Publicar aprobados". Clicking "Volver" returns to `"listo"` phase. Category override selects work (changing categoria resets subcategoria). SmartApplyResult displays after publishing.

---

### T9: Preserve fast path — skip review when no gaps
**File**: `components/admin/ImportarPanel.tsx`
**Type**: modify
**Depends on**: T7, T8
**What to implement**:
In the `"listo"` phase render section, conditionally show different action buttons based on gap content:

```tsx
{fase === "listo" && (
  <>
    {/* ... existing diff summary ... */}

    {/* Smart import path — shown when gaps exist */}
    {(gaps.newBrands.length > 0 || gaps.unmappedCategories.length > 0) && nuevos.length > 0 && (
      <button onClick={handleRevisar}
        className="px-4 py-2 bg-[#3D2018] text-white text-sm">
        Revisar y publicar ({nuevos.length} nuevos)
      </button>
    )}

    {/* Fast path — shown when no gaps */}
    {gaps.newBrands.length === 0 && gaps.unmappedCategories.length === 0 && nuevos.length > 0 && (
      <button onClick={handleAplicar}  {/* existing handler */}
        className="px-4 py-2 bg-[#3D2018] text-white text-sm">
        Aplicar seleccionados ({seleccionados.size})
      </button>
    )}
  </>
)}
```

The existing `aplicarCambios` flow (`handleAplicar`, `"aplicando"` phase, progress bar, result display) is **completely unchanged**. This task only gates which button is shown.

**Acceptance**: With a fully-mapped catalog (all WooCommerce categories in `WOO_CAT_MAP`, no new brands), only "Aplicar seleccionados" is shown and the existing flow works exactly as before. With unmapped categories or new brands, "Revisar y publicar" is shown instead.

---

## Review Workload Forecast

| Metric | Estimate |
|---|---|
| New files | 1 (`lib/category-suggester.ts`, ~120 lines) |
| Modified files | 2 (`actions/importar.ts` ~+180 lines, `components/admin/ImportarPanel.tsx` ~+200 lines) |
| **Total estimated changed lines** | **~500 lines** |
| Chained PRs recommended | **No** — changes are cohesive (one feature, one PR); backend (T1–T6) and frontend (T7–T9) could be split if the team prefers, but the feature is not releasable without both halves |
| Decision needed before apply | No |

---

## Result

- **status**: success
- **executive_summary**: Nine ordered tasks covering a new pure utility (`category-suggester.ts`), additive server-side gap detection in `calcularDiff`, a new `publicarAprobados` action, and the review UI in `ImportarPanel`. Key finding: `generateSEO` is synchronous, so Step F in T6 calls it sync and updates Supabase directly. WooCommerce category type was missing `name` — T1 fixes that before any other task depends on it.
- **artifacts**: `openspec/changes/smart-import/tasks.md`
- **next_recommended**: sdd-apply
- **risks**: []
- **skill_resolution**: paths-injected
- **review_workload**: { estimated_lines: 500, chained_prs_recommended: false, decision_needed: false }
