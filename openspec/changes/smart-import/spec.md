# Smart Import — Technical Spec

## Status
`draft` — produced by sdd-spec phase

---

## 1. Data Contracts (TypeScript Interfaces)

All types live in `actions/importar.ts` unless noted. Export everything that crosses the server/client boundary.

### 1.1 `UnmappedCategory`

```ts
export interface UnmappedCategory {
  /** WooCommerce category ID */
  wooCatId: number;
  /** WooCommerce category name as returned by the API */
  wooCatName: string;
  /** Suggested canonical categoria (e.g. "peluqueria") */
  suggestedCategoria: string;
  /** Suggested canonical subcategoria slug (e.g. "champus") */
  suggestedSubcategoria: string;
  /** How confident the suggestion is */
  confidence: "high" | "medium" | "low";
}
```

### 1.2 `DiffGaps`

Returned as part of the enhanced `calcularDiff()` result. Describes what the diff found that requires admin attention before publishing.

```ts
export interface DiffGaps {
  /**
   * Brand names (normalized, lowercase) detected in new products
   * that have NO matching record in the `marcas` table.
   * These will be auto-inserted during publicarAprobados().
   */
  newBrands: string[];
  /**
   * WooCommerce categories present in NEW products that are NOT
   * in WOO_CAT_MAP, with a keyword-based suggestion.
   * Already-mapped categories are not included here.
   */
  unmappedCategories: UnmappedCategory[];
}
```

### 1.3 `ReviewGroup`

Represents one group of products sharing the same suggested categoria+subcategoria, with approval state managed client-side.

```ts
export interface ReviewGroup {
  /** Unique key: "{suggestedCategoria}/{suggestedSubcategoria}" */
  groupKey: string;
  /** Suggested categoria (may be overridden by admin) */
  suggestedCategoria: string;
  /** Suggested subcategoria (may be overridden by admin) */
  suggestedSubcategoria: string;
  confidence: "high" | "medium" | "low";
  /** Products in this group: only the minimal data needed for the review UI */
  products: Array<{
    slug: string;
    nombre: string;
    wooId: number;
    /** Normalized brand name as detected from WooCommerce */
    brandName: string;
  }>;
  /** WooCommerce category IDs that produced this group */
  sourceWooCatIds: number[];
}
```

### 1.4 `ReviewPayload`

Submitted by the admin when clicking "Publicar aprobados". Contains only approved groups with their final (possibly admin-overridden) categoria/subcategoria.

```ts
export interface ReviewPayload {
  /**
   * Each entry is one approved group.
   * Rejected groups are simply absent from this array.
   */
  approvedGroups: Array<{
    /** Products to publish */
    slugsConId: Array<{ slug: string; wooId: number }>;
    /** Final categoria decided by the admin (may differ from suggestion) */
    categoria: string;
    /** Final subcategoria decided by the admin (may differ from suggestion) */
    subcategoria: string;
  }>;
}
```

### 1.5 `SmartApplyResult`

Returned by `publicarAprobados()`.

```ts
export interface SmartApplyResult {
  /** Number of products successfully upserted and set to activo=true */
  ok: number;
  /** Brand names auto-created in `marcas` during this run */
  brandsCreated: string[];
  /** Slugs for which SEO generation was triggered */
  seoTriggered: string[];
  /** Slugs not found in WooCommerce (fetch failed) */
  notFound: string[];
  error?: string;
}
```

---

## 2. Server Actions Changes (`actions/importar.ts`)

### 2.1 Enhanced `calcularDiff()` return type

Add `gaps: DiffGaps` to the existing return:

```ts
export async function calcularDiff(): Promise<{
  nuevos: ProductoDiff[];
  modificados: ProductoDiff[];
  iguales: number;
  gaps: DiffGaps;
  error?: string;
}>
```

**Changes to the implementation:**

1. After building the `nuevos` array, pass `nuevos` and `wooProductos` slice to two new helper functions (see §2.3 and §2.4).
2. `gaps.newBrands` is computed by `detectNewBrands(nuevos, wooProductos, existingMarcaSlugs)`.
3. `gaps.unmappedCategories` is computed by iterating the WooCommerce categories of `nuevos` products, filtering out any `cat.id` already in `WOO_CAT_MAP`, deduplicating by `wooCatId`, and calling `suggestCategory(wooCatName, productName)` for each unmapped category.
4. On error, return `gaps: { newBrands: [], unmappedCategories: [] }` alongside the existing error fields.

**Required Supabase read inside `calcularDiff()`:**

```sql
SELECT slug FROM marcas
```

Fetch all existing `marcas.slug` values once (no pagination needed; current catalog is small) into a `Set<string>` for O(1) lookup during brand detection.

### 2.2 New action `publicarAprobados(payload: ReviewPayload)`

```ts
export async function publicarAprobados(
  payload: ReviewPayload
): Promise<SmartApplyResult>
```

**Algorithm (sequential steps, all in one Server Action):**

#### Step A — Validate admin
Call `verificarAdmin()` at the top. Return `{ ok: 0, brandsCreated: [], seoTriggered: [], notFound: [], error: "No autorizado" }` on failure.

#### Step B — Fetch WooCommerce data
Collect all `{ slug, wooId }` from `payload.approvedGroups` into a flat array. Fetch each product from WooCommerce using the existing `fetchWoo("/products/{wooId}")` pattern with `PARALELO = 20` concurrent requests (same as `aplicarCambios`). Track `notFound` for failed fetches.

#### Step C — Auto-create new brands
1. For each fetched product, extract `brandName` using `extractBrandName(product.name)` (§2.3).
2. Normalize: `brandSlug = slugify(brandName)`.
3. Load current `marcas.slug` set from Supabase (one query, all slugs).
4. For each brand slug not in the existing set, insert:
   ```ts
   { nombre: brandName, slug: brandSlug, logo_url: null }
   ```
   Use `upsert` with `onConflict: "slug"` and `ignoreDuplicates: true` to be safe.
5. After insert, reload `marcas` to get the new `id → slug` mapping for `marca_id` resolution.

#### Step D — Upsert products with final categoria/subcategoria
For each approved group, upsert its products using the **group's final `categoria` and `subcategoria`** (not the WooCommerce-resolved ones). This overrides the default `resolverCategoria()` call.

Upsert row fields — same as `aplicarCambios()` with two key differences:
- `activo: true` (publish immediately)
- `marca_id`: resolved from `marcas` by matching `extractBrandName(product.name)` → slug → marcas id. Use `null` if not found (non-blocking).

#### Step E — Upsert variations
Same logic as `aplicarCambios()`: for `type === "simple"` products with a `sku`, upsert into `productos_variaciones`.

#### Step F — Trigger SEO generation
After all upserts, query:
```sql
SELECT slug FROM productos_padre
WHERE slug = ANY(publishedSlugs)
  AND (texto_enriquecido_seo IS NULL OR texto_enriquecido_seo = '')
```
For each slug needing SEO, call `generateSEO(producto)` from `lib/seo-generator.ts` using `Promise.allSettled` (non-blocking; do not fail the whole action if SEO fails for some products). Collect successfully triggered slugs into `seoTriggered`.

#### Step G — Return result
```ts
return { ok: upsertedCount, brandsCreated, seoTriggered, notFound };
```

### 2.3 Helper: `extractBrandName(productName: string): string`

**Location:** top-level private function inside `actions/importar.ts`.

**Algorithm:**
1. Normalize: trim and collapse multiple spaces.
2. Split by space.
3. Take the first word. If the second word is also fully uppercase or starts with uppercase AND is ≤ 12 characters AND does not look like a descriptor (i.e., is not in a descriptor blocklist: `["de", "del", "para", "con", "y", "e", "el", "la", "los", "las"]`), take first two words.
4. Return as-is (preserve original casing for `marcas.nombre`; caller slugifies separately).

**Examples:**
- `"Wella Color Charm Tinte"` → `"Wella"`
- `"L'Oréal Professionnel Serie Expert"` → `"L'Oréal Professionnel"`
- `"BES Hair Fashion Shampoo"` → `"BES Hair"`
- `"Champú de Kerastase"` → `"Champú"` (first word only — second word is a descriptor)

> Note: this is best-effort. The review screen surfaces brand names so the admin can verify before approving.

### 2.4 Helper: `detectNewBrands(nuevos, wooProductos, existingMarcaSlugs)`

**Location:** top-level private function inside `actions/importar.ts`.

**Signature:**
```ts
function detectNewBrands(
  nuevos: ProductoDiff[],
  wooProductos: WooProducto[],
  existingMarcaSlugs: Set<string>
): string[]
```

**Algorithm:**
1. Build a `Map<string, WooProducto>` from `wooProductos` keyed by `p.slug`.
2. For each `nuevo` in `nuevos`, find the corresponding WooProducto by slug.
3. Extract brand via `extractBrandName(p.name)`.
4. Slugify brand name; check against `existingMarcaSlugs`.
5. Collect unique new brand names (use a `Set` to deduplicate; return as `string[]` of normalized brand names).

---

## 3. New Utility: `lib/category-suggester.ts`

### 3.1 Exports

```ts
export interface CategorySuggestion {
  categoria: string;
  subcategoria: string;
  confidence: "high" | "medium" | "low";
}

export function suggestCategory(
  wooCatName: string,
  productName: string
): CategorySuggestion
```

### 3.2 Data source

Import `NAV_ITEMS` from `@/lib/categorias` at module level. No DB access; no async.

Build the valid pair list once at module load time (or lazily on first call):

```ts
const ALL_PAIRS: Array<{ categoria: string; subcategoria: string; tokens: string[] }> =
  NAV_ITEMS.flatMap(item => {
    if (!item.columnas) return [];
    const categoria = item.href.split("/")[2]; // e.g. "peluqueria"
    return item.columnas.flatMap(col =>
      col.links.map(link => {
        const subcategoria = link.href.split("/")[3]; // e.g. "champus"
        const tokens = subcategoria.split("-").filter(t => t.length > 2); // de-hyphenate
        return { categoria, subcategoria, tokens };
      })
    );
  });
```

### 3.3 Token matching algorithm

**Input normalization:**

```ts
function normalize(s: string): string {
  return s.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // remove diacritics
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
```

**Scoring per pair:**

| Match type | Score |
|---|---|
| Normalized `wooCatName` contains the full `subcategoria` slug (without hyphens) | 100 |
| Any token from `subcategoria` slug appears in normalized `wooCatName` | 60 per token |
| Any token from `subcategoria` slug appears in normalized `productName` | 30 per token |

Sum tokens; cap at 100. Deduplicate token matches (each token counted once per signal source).

**Confidence mapping:**

| Score | Confidence |
|---|---|
| ≥ 80 | `"high"` |
| 40 – 79 | `"medium"` |
| < 40 | `"low"` |

**Fallback:** If the best score is 0, return `{ categoria: "peluqueria", subcategoria: "peluqueria-general", confidence: "low" }` — same as the current `resolverCategoria()` fallback.

**Selection:** return the pair with the highest score. On a tie, prefer the one whose `categoria` also appears in `normalize(wooCatName)`.

---

## 4. UI Changes: `components/admin/ImportarPanel.tsx`

### 4.1 New phase

Add `"revisando"` to the phase union:

```ts
type Fase = "idle" | "diff" | "listo" | "revisando" | "aplicando";
```

**Phase transitions:**

```
idle
 └─[Calcular diff]→ diff
                    └─[result received]→ listo
                                         └─[Revisar]→ revisando   ← NEW
                                                       └─[Publicar aprobados]→ aplicando
                                                                                └─[done]→ listo
```

The existing "Aplicar seleccionados" button is renamed to **"Revisar y publicar"** and now transitions to `"revisando"` instead of directly calling `aplicarCambios`. The old `aplicarCambios` direct path is replaced by `publicarAprobados`.

### 4.2 New state

```ts
// Gaps from enhanced calcularDiff()
const [gaps, setGaps] = useState<DiffGaps>({ newBrands: [], unmappedCategories: [] });

// Review groups derived from nuevos + gaps (built client-side when entering "revisando")
const [reviewGroups, setReviewGroups] = useState<ReviewGroup[]>([]);

// Per-group approval state: groupKey → { approved: boolean, overrideCategoria?, overrideSubcategoria? }
const [groupApprovals, setGroupApprovals] = useState<
  Map<string, { approved: boolean; overrideCategoria?: string; overrideSubcategoria?: string }>
>(new Map());

// Smart apply result
const [smartResult, setSmartResult] = useState<SmartApplyResult | null>(null);
```

### 4.3 `buildReviewGroups(nuevos, gaps)` client-side helper

Called when transitioning from `"listo"` → `"revisando"`. Runs entirely in the browser.

**Algorithm:**
1. For each `nuevo` product, look up its WooCommerce category IDs.
   - **Problem:** `ProductoDiff` from `calcularDiff()` currently doesn't carry category IDs.
   - **Fix:** Extend `ProductoDiff` to include `wooCategories: number[]` (see §2, addendum).
2. For each product, find if its `wooCategories` contain any `wooCatId` in `gaps.unmappedCategories`.
   - If yes → use the `UnmappedCategory` suggestion for this product's group key.
   - If no (category already in `WOO_CAT_MAP`) → the product's category is already resolved; group it under `resolvedByMap: true` and use the existing mapped categoria/subcategoria.
3. Group by `"{categoria}/{subcategoria}"`.
4. Products from already-mapped categories are pre-approved and grouped separately (not shown in the review unless the admin explicitly wants to review them — out of scope for v1: show only unmapped groups in the review screen).

> **Addendum to §2.1:** `ProductoDiff` must include `wooCategories: number[]` for the client to build review groups without a second server round-trip. Add this field in `calcularDiff()` when constructing `nuevos`.

### 4.4 Review screen layout (fase === "revisando")

```
┌─────────────────────────────────────────────────────────────────┐
│  Nuevas marcas detectadas                                       │
│  [badge] Wella   [badge] Redken   [badge] Revlon               │
│  (estas se crearán automáticamente sin logo al publicar)        │
├─────────────────────────────────────────────────────────────────┤
│  Grupos por categoría sugerida ({N} grupos)                     │
│                                                                 │
│  ▶ [✓ Aprobar] Peluquería › Champús  [ALTA]  12 productos      │
│  ▶ [✓ Aprobar] Estética › Cremas...  [MEDIA]  4 productos      │
│     Override: [dropdown categoria] › [dropdown subcategoria]    │
│  ▶ [✓ Aprobar] Sin categoría         [BAJA]   7 productos      │
│     (expanded) Champú Wella Color... | BES Shampoo... | ...     │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  [Publicar aprobados (N)]              [Volver]                 │
└─────────────────────────────────────────────────────────────────┘
```

**Group row (collapsed):**
- Toggle: checkbox or switch (`approved` state). Default: **approved** for `"high"` confidence, **unapproved** for `"medium"` and `"low"`.
- Confidence badge: green (`"high"`), amber (`"medium"`), red (`"low"`).
- `categoria label › subcategoria label` (resolved from `NAV_ITEMS` for display).
- Product count.
- Expand arrow.

**Group row (expanded):**
- Flat list of product names (truncated to 60 chars) + brand name.
- Category override: two `<select>` dropdowns. First selects `categoria` from top-level NAV_ITEMS. Second selects `subcategoria` scoped to the selected `categoria`.
  - Dropdown option values are the slug (`"peluqueria"`); display text is the label (`"Peluquería"`).
  - Built from `NAV_ITEMS` at render time (no additional fetch).

**New brands section:**
- Rendered above the groups.
- Each brand shown as a `<span>` badge with a "sin logo" indicator.
- Informational only in v1 (no action needed here).

**"Publicar aprobados" button:**
- Disabled when 0 groups are approved.
- Label: `Publicar aprobados (N)` where N = total product count across approved groups.

### 4.5 `handlePublicarAprobados()`

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

  setFase("aplicando");
  const result = await publicarAprobados({ approvedGroups });
  setSmartResult(result);
  setFase("listo");
}
```

### 4.6 Progress during `"aplicando"`

Re-use the existing `progreso` state and bar. Set `progreso.total` to the total approved product count before calling `publicarAprobados`. Since the action is one server round-trip, show an indeterminate progress animation (set `progreso.ok = 0` and animate until the promise resolves).

---

## 5. Database Considerations

### 5.1 No new migrations required

- `marcas` table already has `id, nombre, slug, logo_url` — correct columns for auto-insert.
- `productos_padre` already has `marca_id` (nullable FK) — no changes needed.
- Categories remain hardcoded in `lib/categorias.ts`.

### 5.2 Index on `marcas.slug`

Check migration `001` (`supabase/migrations/001_*.sql` or similar). If `marcas.slug` does not have a unique index, **add one** — `publicarAprobados()` relies on upsert with `onConflict: "slug"`.

Migration (add only if missing):

```sql
-- Add unique constraint on marcas.slug if not already present
ALTER TABLE marcas ADD CONSTRAINT marcas_slug_key UNIQUE (slug);
```

This is a low-risk DDL change (table has few rows, constraint should already exist logically). Confirm by inspecting the existing migrations before adding.

### 5.3 `marca_id` population

`publicarAprobados()` will set `marca_id` for newly published products (Step C + D in §2.2). Existing products updated through `aplicarCambios()` do not need `marca_id` set — that path is unchanged.

---

## 6. Acceptance Criteria

| # | Criterion | How to verify |
|---|---|---|
| AC-1 | `calcularDiff()` returns `gaps.newBrands` containing brand names of new products whose normalized slug is not in `marcas` | Unit test: mock `marcas` to return `["wella"]`, call with a product named `"Redken Shades EQ"` → `gaps.newBrands` includes `"Redken"` |
| AC-2 | `calcularDiff()` returns `gaps.unmappedCategories` with a suggestion for any WooCommerce category ID not in `WOO_CAT_MAP` | Unit test: use a woo category ID not in the map; verify `unmappedCategories.length > 0` and `confidence` is set |
| AC-3 | `suggestCategory("Champús Profesionales", "Wella Shampoo")` returns `{ categoria: "peluqueria", subcategoria: "champus", confidence: "high" }` | Unit test against the real `NAV_ITEMS` |
| AC-4 | The review screen shows groups only for unmapped categories; products from already-mapped categories are not shown (they are implicitly approved) | Manual: run diff where some new products have mapped cats and some don't; only unmapped appear in review groups |
| AC-5 | Rejecting all groups in the review screen keeps "Publicar aprobados" button disabled | UI: uncheck all groups → button is disabled |
| AC-6 | After `publicarAprobados()` completes, approved products have `activo = true` in Supabase | DB check: `SELECT activo FROM productos_padre WHERE slug = ANY(approvedSlugs)` returns all `true` |
| AC-7 | Brands in `gaps.newBrands` appear in `marcas` with `logo_url = null` after publishing | DB check: `SELECT logo_url FROM marcas WHERE slug = 'new-brand-slug'` returns `null` |
| AC-8 | Products without `texto_enriquecido_seo` are included in `SmartApplyResult.seoTriggered`; products that already had SEO text are not | DB check before and after; verify `seoTriggered` list matches only those with null SEO |

---

## 7. Out of Scope (confirmed from proposal)

- Dynamic category management from DB
- AI-powered or embedding-based category suggestion
- Per-product category override (group-level only)
- Logo auto-download for new brands
- Undo/rollback after bulk-publish

---

## Risks

| Severity | Risk | Mitigation |
|---|---|---|
| MEDIUM | `extractBrandName()` heuristic misidentifies brand from product name — e.g. product starts with a descriptor like "Champú de Revlon" → extracts "Champú" | Surface raw extracted brand in review screen so admin can catch it; this is a cosmetic issue (wrong brand badge), not a data integrity issue since `marca_id` is nullable |
| MEDIUM | `ProductoDiff` interface change (adding `wooCategories: number[]`) is a breaking change for `ImportarPanel.tsx` which imports that type | Both files are in the same repo; update must be done atomically. Spec mandates the addendum to §2.1 |
| LOW | `suggestCategory()` called for every unique unmapped category — N is tiny (typically 1–5 per import run) — no performance concern | No mitigation needed |
| LOW | `marcas.slug` unique constraint may not exist in the DB, causing `upsert onConflict: "slug"` to fail silently or error | Check migration 001; add constraint if missing (see §5.2) |
| LOW | SEO generation via `generateSEO()` uses an external AI call; if it throws, `Promise.allSettled` prevents blocking the publish — but the admin won't see per-product SEO errors | Log failures server-side; `seoTriggered` only reflects successes, so the admin can re-run SEO batch for missing ones |
