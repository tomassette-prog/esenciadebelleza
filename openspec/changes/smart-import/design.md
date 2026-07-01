# Smart Import — Technical Design

## Status
`draft` — produced by sdd-design phase

---

## 1. `lib/category-suggester.ts` — Full Algorithm

### 1.1 Module structure

```ts
import { NAV_ITEMS } from "@/lib/categorias";
```

No DB access. No async. Pure functions.

### 1.2 Flat pair list — built once at module load

```ts
interface RawPair {
  categoria: string;     // e.g. "peluqueria"
  subcategoria: string;  // e.g. "ampollas-y-serums"
  tokens: string[];      // ["ampollas", "serums"] — words with length > 2
}

const ALL_PAIRS: RawPair[] = NAV_ITEMS.flatMap(item => {
  if (!item.columnas) return [];
  const categoria = item.href.split("/")[2]; // /productos/{categoria}
  return item.columnas.flatMap(col =>
    col.links.map(link => {
      const subcategoria = link.href.split("/")[3]; // /productos/{cat}/{subcategoria}
      const tokens = subcategoria.split("-").filter(t => t.length > 2);
      return { categoria, subcategoria, tokens };
    })
  );
});
```

**Note:** `item.href` for non-product nav items (e.g. `/marcas`, `/blog`) will have `split("/")[2]` return `"marcas"` or `"blog"`. These items have no `columnas`, so the `if (!item.columnas) return []` guard excludes them correctly.

### 1.3 Normalization helper

```ts
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")   // remove diacritics
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
```

### 1.4 Scoring algorithm

For each `RawPair`, compute a score against (`wooCatName`, `productName`):

| Match condition | Points |
|---|---|
| `normalize(wooCatName)` contains the full subcategoria slug (with hyphens removed) | +100 |
| Any token from `subcategoria` appears as a word in `normalize(wooCatName)` | +60 per token (each token counted once) |
| Any token from `subcategoria` appears as a word in `normalize(productName)` | +30 per token (each token counted once) |

**Implementation detail:** "appears as a word" means the token is bounded by word boundaries or spaces, not necessarily an isolated word. Simplest approach: check `normalizedText.includes(token)` — acceptable for slug tokens which are already single words.

**Score cap:** 100. Clamp: `Math.min(100, rawScore)`.

**On tie:** prefer the pair whose `categoria` also appears in `normalize(wooCatName)`.

### 1.5 Confidence mapping

| Score | Confidence |
|---|---|
| ≥ 80 | `"high"` |
| 40 – 79 | `"medium"` |
| < 40 | `"low"` |

### 1.6 Fallback

If best score is 0 (no token matched anything): return `{ categoria: "peluqueria", subcategoria: "peluqueria-general", confidence: "low" }`.

Note: `"peluqueria-general"` does **not** exist as a link in NAV_ITEMS; it is intentionally a sentinel value that the admin will always need to override (confidence is `"low"`).

### 1.7 `suggestCategory` — full signature

```ts
export interface CategorySuggestion {
  categoria: string;
  subcategoria: string;
  confidence: "high" | "medium" | "low";
}

export function suggestCategory(
  wooCatName: string,
  productName: string
): CategorySuggestion {
  const normCat  = normalize(wooCatName);
  const normProd = normalize(productName);

  let bestScore = 0;
  let bestPair: RawPair = ALL_PAIRS[0];

  for (const pair of ALL_PAIRS) {
    // Score: exact slug match (hyphens removed)
    const slugFlat = pair.subcategoria.replace(/-/g, "");
    let score = normCat.includes(slugFlat) ? 100 : 0;

    if (score < 100) {
      // Token matching
      for (const token of pair.tokens) {
        if (normCat.includes(token))  score += 60;
        if (normProd.includes(token)) score += 30;
      }
      score = Math.min(score, 100);
    }

    if (
      score > bestScore ||
      (score === bestScore && score > 0 && normCat.includes(pair.categoria))
    ) {
      bestScore = score;
      bestPair  = pair;
    }
  }

  if (bestScore === 0) {
    return { categoria: "peluqueria", subcategoria: "peluqueria-general", confidence: "low" };
  }

  const confidence: CategorySuggestion["confidence"] =
    bestScore >= 80 ? "high" : bestScore >= 40 ? "medium" : "low";

  return { categoria: bestPair.categoria, subcategoria: bestPair.subcategoria, confidence };
}
```

### 1.8 `getAllCategoriaPairs` — for UI dropdown

```ts
export interface CategoriaPair {
  categoria: string;
  subcategoria: string;
  label: string;       // e.g. "Peluquería › Champús"
}

export function getAllCategoriaPairs(): CategoriaPair[] {
  return NAV_ITEMS.flatMap(item => {
    if (!item.columnas) return [];
    const categoria = item.href.split("/")[2];
    const categoriaLabel = item.label;
    return item.columnas.flatMap(col =>
      col.links.map(link => ({
        categoria,
        subcategoria: link.href.split("/")[3],
        label: `${categoriaLabel} › ${link.label}`,
      }))
    );
  });
}
```

---

## 2. `actions/importar.ts` — Exact Changes

### 2.1 New / updated interfaces

Add these exports at the top of the file, alongside the existing `ProductoDiff`:

```ts
// MODIFIED: add wooCategories field
export interface ProductoDiff {
  slug: string;
  nombre: string;
  tipo: "nuevo" | "modificado";
  wooId: number;
  wooCategories: number[];   // ← NEW: WooCommerce category IDs for this product
  cambios?: Record<string, { woo: string | null; actual: string | null }>;
}

export interface UnmappedCategory {
  wooCatId: number;
  wooCatName: string;
  suggestedCategoria: string;
  suggestedSubcategoria: string;
  confidence: "high" | "medium" | "low";
}

export interface DiffGaps {
  newBrands: string[];
  unmappedCategories: UnmappedCategory[];
}

export interface ReviewGroup {
  groupKey: string;
  suggestedCategoria: string;
  suggestedSubcategoria: string;
  confidence: "high" | "medium" | "low";
  products: Array<{
    slug: string;
    nombre: string;
    wooId: number;
    brandName: string;
  }>;
  sourceWooCatIds: number[];
}

export interface ReviewPayload {
  approvedGroups: Array<{
    slugsConId: Array<{ slug: string; wooId: number }>;
    categoria: string;
    subcategoria: string;
  }>;
}

export interface SmartApplyResult {
  ok: number;
  brandsCreated: string[];
  seoTriggered: string[];
  notFound: string[];
  error?: string;
}
```

### 2.2 New private helper: `extractBrandName`

Placed above `calcularDiff`, not exported:

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

### 2.3 New private helper: `detectNewBrands`

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

**Note:** `wooMap` is keyed by `wooId` (not slug) — cheaper than a slug lookup since we already have the WooCommerce products array from the fetch loop in `calcularDiff`.

### 2.4 Modified `calcularDiff` — additions only

The existing fetch + compare logic is **unchanged**. The following changes are additive:

**a) Extend `nuevos.push(...)` to include `wooCategories`:**

```ts
// BEFORE:
nuevos.push({ slug, nombre: p.name, tipo: "nuevo", wooId: p.id });

// AFTER:
nuevos.push({
  slug,
  nombre: p.name,
  tipo: "nuevo",
  wooId: p.id,
  wooCategories: p.categories.map((c: { id: number }) => c.id),
});
```

**b) After the compare loop, add gap detection:**

```ts
// 4. Fetch existing marcas slugs (one query)
const { data: marcasRows } = await supa.from("marcas").select("slug");
const existingMarcaSlugs = new Set<string>(
  (marcasRows ?? []).map((r: { slug: string }) => r.slug)
);

// 5. Build wooMap for brand extraction
const wooMap = new Map(wooProductos.map(p => [p.id, p]));

// 6. Detect gaps
const newBrands = detectNewBrands(nuevos, wooMap, existingMarcaSlugs);

// 7. Detect unmapped categories (deduplicated by wooCatId)
const { suggestCategory } = await import("@/lib/category-suggester");
const seenCatIds = new Set<number>();
const unmappedCategories: UnmappedCategory[] = [];

for (const nuevo of nuevos) {
  for (const catId of nuevo.wooCategories) {
    if (WOO_CAT_MAP[catId] || seenCatIds.has(catId)) continue;
    seenCatIds.add(catId);
    // Find the WooCommerce category name from the first product that has it
    const wooP = wooMap.get(nuevo.wooId);
    const cat = (wooP as any)?.categories?.find((c: { id: number; name: string }) => c.id === catId);
    const wooCatName = cat?.name ?? String(catId);
    const suggestion = suggestCategory(wooCatName, nuevo.nombre);
    unmappedCategories.push({
      wooCatId: catId,
      wooCatName,
      suggestedCategoria:    suggestion.categoria,
      suggestedSubcategoria: suggestion.subcategoria,
      confidence:            suggestion.confidence,
    });
  }
}

const gaps: DiffGaps = { newBrands, unmappedCategories };
```

**c) Updated return type:**

```ts
export async function calcularDiff(): Promise<{
  nuevos: ProductoDiff[];
  modificados: ProductoDiff[];
  iguales: number;
  gaps: DiffGaps;
  error?: string;
}>
```

**d) Error return — backward compatible:**

```ts
return {
  nuevos: [], modificados: [], iguales: 0,
  gaps: { newBrands: [], unmappedCategories: [] },
  error: String(e),
};
```

**Implementation note on dynamic import:** `suggestCategory` is imported dynamically (`await import(...)`) to avoid a circular dependency risk between `actions/importar.ts` → `lib/category-suggester.ts` → `lib/categorias.ts` → `actions/importar.ts`. If the codebase has no circular path, switch to a static import at the top of the file.

### 2.5 New action: `publicarAprobados`

```ts
export async function publicarAprobados(
  payload: ReviewPayload
): Promise<SmartApplyResult> {
  // Step A — Validate admin
  try {
    await verificarAdmin();
  } catch {
    return { ok: 0, brandsCreated: [], seoTriggered: [], notFound: [], error: "No autorizado" };
  }

  try {
    // Step B — Collect all slugsConId
    const allSlugsConId = payload.approvedGroups.flatMap(g => g.slugsConId);
    if (!allSlugsConId.length) {
      return { ok: 0, brandsCreated: [], seoTriggered: [], notFound: [] };
    }

    // Step B — Fetch WooCommerce data (same PARALELO=20 pattern as aplicarCambios)
    type WooProducto = { /* same shape as in aplicarCambios */ ... };
    const PARALELO = 20;
    const fetched: WooProducto[] = [];
    const notFound: string[] = [];
    for (let i = 0; i < allSlugsConId.length; i += PARALELO) {
      const lote = allSlugsConId.slice(i, i + PARALELO);
      const results = await Promise.all(
        lote.map(({ slug, wooId }) =>
          (fetchWoo(`/products/${wooId}`) as Promise<WooProducto>)
            .then(p => ({ ok: true as const, p }))
            .catch(() => ({ ok: false as const, slug }))
        )
      );
      for (const r of results) {
        if (r.ok) fetched.push(r.p);
        else notFound.push(r.slug);
      }
    }

    const supa = adminClient();

    // Step C — Auto-create new brands
    const { data: existingMarcas } = await supa.from("marcas").select("id, slug, nombre");
    const marcaSlugToId = new Map<string, number>(
      (existingMarcas ?? []).map((m: { id: number; slug: string }) => [m.slug, m.id])
    );

    const brandsToInsert: Array<{ nombre: string; slug: string; logo_url: null }> = [];
    for (const p of fetched) {
      const brandName = extractBrandName(p.name);
      const brandSlug = slugify(brandName);
      if (!marcaSlugToId.has(brandSlug)) {
        brandsToInsert.push({ nombre: brandName, slug: brandSlug, logo_url: null });
        marcaSlugToId.set(brandSlug, -1); // placeholder to avoid duplicates in this batch
      }
    }

    const brandsCreated: string[] = [];
    if (brandsToInsert.length > 0) {
      const { data: inserted } = await supa
        .from("marcas")
        .upsert(brandsToInsert, { onConflict: "slug", ignoreDuplicates: true })
        .select("id, slug, nombre");
      for (const m of inserted ?? []) {
        marcaSlugToId.set(m.slug, m.id);
        brandsCreated.push(m.nombre);
      }
      // Re-fetch to ensure marcaSlugToId is complete (upsert may not return skipped rows)
      const { data: allMarcas } = await supa.from("marcas").select("id, slug");
      for (const m of allMarcas ?? []) marcaSlugToId.set(m.slug, m.id);
    }

    // Step D — Build slug → final categoria/subcategoria map from payload
    const slugToCat = new Map<string, { categoria: string; subcategoria: string }>();
    for (const group of payload.approvedGroups) {
      for (const { slug } of group.slugsConId) {
        slugToCat.set(slug, { categoria: group.categoria, subcategoria: group.subcategoria });
      }
    }

    // Step D — Load existing product flags
    const publishedSlugs = fetched.map(p => p.slug || slugify(p.name));
    const { data: existentes } = await supa
      .from("productos_padre")
      .select("slug, destacado, nuevo")
      .in("slug", publishedSlugs);
    const existMap = new Map((existentes ?? []).map(e => [e.slug, e]));

    // Step D — Prepare upsert rows (activo=true, override categoria/subcategoria)
    const rows = fetched.map(p => {
      const slug = p.slug || slugify(p.name);
      const { categoria, subcategoria } = slugToCat.get(slug) ?? resolverCategoria(p.categories);
      const ex = existMap.get(slug);
      const brandName = extractBrandName(p.name);
      const brandSlug = slugify(brandName);
      const marcaId = marcaSlugToId.get(brandSlug) ?? null;
      const suffix = " | Esencia de Belleza";
      const nombreTruncado = p.name.trim().slice(0, 60 - suffix.length);
      return {
        nombre: p.name.trim(),
        slug,
        categoria,
        subcategoria,
        marca_id: marcaId,
        descripcion_general: p.description || p.short_description || null,
        imagen_principal_url: p.images[0]?.src ?? null,
        seo_title: `${nombreTruncado}${suffix}`,
        seo_description: `Compra ${p.name.trim()} al mejor precio. Envío 24-48h a toda España.`,
        activo:    true,           // ← always publish
        destacado: ex?.destacado ?? false,
        nuevo:     ex?.nuevo     ?? false,
      };
    });

    const { error: upsertError } = await supa
      .from("productos_padre")
      .upsert(rows, { onConflict: "slug" });
    if (upsertError) {
      return { ok: 0, brandsCreated, seoTriggered: [], notFound, error: upsertError.message };
    }

    // Step E — Upsert variations (same pattern as aplicarCambios)
    for (const p of fetched) {
      if (p.type !== "simple" || !p.sku) continue;
      const { data: padre } = await supa
        .from("productos_padre")
        .select("id")
        .eq("slug", p.slug || slugify(p.name))
        .single();
      if (!padre) continue;
      const precio = parseFloat(p.price || p.regular_price) || 0;
      const stock  = p.stock_quantity ?? (p.stock_status === "instock" ? 1 : 0);
      await supa.from("productos_variaciones").upsert(
        {
          producto_id: padre.id,
          sku: p.sku,
          nombre_variacion: "Unidad",
          precio_b2c: precio,
          precio_b2b: precio,
          stock,
          activa: true,
        },
        { onConflict: "sku" }
      );
    }

    // Step F — Trigger SEO for products without enriched SEO
    const { data: needSeo } = await supa
      .from("productos_padre")
      .select("slug, nombre, categoria, subcategoria, seo_title, seo_description")
      .in("slug", publishedSlugs)
      .or("texto_enriquecido_seo.is.null,texto_enriquecido_seo.eq.");

    const seoTriggered: string[] = [];
    if (needSeo && needSeo.length > 0) {
      const { generateSEO } = await import("@/lib/seo-generator");
      const seoResults = await Promise.allSettled(
        needSeo.map(p => generateSEO(p).then(() => p.slug))
      );
      for (const r of seoResults) {
        if (r.status === "fulfilled") seoTriggered.push(r.value);
      }
    }

    // Step G — Return
    return { ok: rows.length, brandsCreated, seoTriggered, notFound };

  } catch (e) {
    return { ok: 0, brandsCreated: [], seoTriggered: [], notFound: [], error: String(e) };
  }
}
```

---

## 3. `components/admin/ImportarPanel.tsx` — State Machine & UI

### 3.1 Updated imports

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
```

### 3.2 Phase type extension

```ts
type Fase = "idle" | "diff" | "listo" | "revisando" | "publicando" | "done";
```

**State machine transitions:**

```
idle ──[Calcular diff]──► diff
                           │
                    result received
                           │
                           ▼
                         listo
                           │
          ┌────────────────┴──────────────────────────┐
          │ gaps.unmappedCategories.length > 0          │ no gaps
          │ OR gaps.newBrands.length > 0                │
          ▼                                             ▼
       [Revisar y publicar]                      [Aplicar seleccionados]
          │                                             │ (existing path, unchanged)
          ▼                                             ▼
       revisando                                    aplicando
          │                                             │
   [Publicar aprobados]                                 │
          │                                             │
          ▼                                             ▼
       publicando ───────────────────────────────► listo (con smartResult o resumen)
```

**Important:** the existing `aplicarCambios` fast path is **preserved unchanged** for the no-gaps case.

### 3.3 New state variables

```ts
// From enhanced calcularDiff
const [gaps, setGaps] = useState<DiffGaps>({ newBrands: [], unmappedCategories: [] });

// Built client-side when entering "revisando"
const [reviewGroups, setReviewGroups] = useState<ReviewGroup[]>([]);

// Per-group approval state
type GroupState = { approved: boolean; overrideCategoria?: string; overrideSubcategoria?: string };
const [groupApprovals, setGroupApprovals] = useState<Map<string, GroupState>>(new Map());

// All valid pairs for the dropdowns (computed once)
const [allPairs] = useState<CategoriaPair[]>(() => getAllCategoriaPairs());

// Smart apply result
const [smartResult, setSmartResult] = useState<SmartApplyResult | null>(null);
```

### 3.4 `buildReviewGroups` — client-side helper

Defined inside the component (or as a module-level pure function):

```ts
function buildReviewGroups(
  nuevos: ProductoDiff[],
  gaps: DiffGaps
): ReviewGroup[] {
  // Build a map: wooCatId → UnmappedCategory suggestion
  const unmappedMap = new Map(
    gaps.unmappedCategories.map(u => [u.wooCatId, u])
  );

  // Group products: key = "categoria/subcategoria"
  const groupMap = new Map<string, ReviewGroup>();

  for (const nuevo of nuevos) {
    // Find first unmapped category for this product
    const unmappedCat = nuevo.wooCategories
      .map(id => unmappedMap.get(id))
      .find(Boolean);

    if (!unmappedCat) continue; // product already covered by WOO_CAT_MAP — skip in review screen

    const key = `${unmappedCat.suggestedCategoria}/${unmappedCat.suggestedSubcategoria}`;
    if (!groupMap.has(key)) {
      groupMap.set(key, {
        groupKey: key,
        suggestedCategoria:    unmappedCat.suggestedCategoria,
        suggestedSubcategoria: unmappedCat.suggestedSubcategoria,
        confidence:            unmappedCat.confidence,
        products:              [],
        sourceWooCatIds:       [],
      });
    }

    const group = groupMap.get(key)!;
    group.products.push({
      slug:      nuevo.slug,
      nombre:    nuevo.nombre,
      wooId:     nuevo.wooId,
      brandName: "",  // filled below if needed (brand detection is server-side)
    });

    // Track unique source cat IDs
    for (const id of nuevo.wooCategories) {
      if (unmappedMap.has(id) && !group.sourceWooCatIds.includes(id)) {
        group.sourceWooCatIds.push(id);
      }
    }
  }

  // Sort: low confidence first (need attention), then medium, then high
  const order = { low: 0, medium: 1, high: 2 };
  return [...groupMap.values()].sort(
    (a, b) => order[a.confidence] - order[b.confidence]
  );
}
```

### 3.5 Updated `handleDiff`

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

### 3.6 `handleRevisar` — enter review mode

Called by the "Revisar y publicar" button (only shown when `gaps` have content):

```ts
function handleRevisar() {
  const groups = buildReviewGroups(nuevos, gaps);
  setReviewGroups(groups);

  // Default: high confidence → approved, medium/low → unapproved
  const initialApprovals = new Map<string, GroupState>(
    groups.map(g => [
      g.groupKey,
      { approved: g.confidence === "high" },
    ])
  );
  setGroupApprovals(initialApprovals);
  setFase("revisando");
}
```

### 3.7 `handlePublicarAprobados`

```ts
async function handlePublicarAprobados() {
  const approvedGroups = [...groupApprovals.entries()]
    .filter(([, state]) => state.approved)
    .map(([groupKey, state]) => {
      const group = reviewGroups.find(g => g.groupKey === groupKey)!;
      return {
        slugsConId: group.products.map(p => ({ slug: p.slug, wooId: p.wooId })),
        categoria:    state.overrideCategoria    ?? group.suggestedCategoria,
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

### 3.8 Review screen UI (`fase === "revisando"`)

**New brands section** (rendered above groups, only when `gaps.newBrands.length > 0`):

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

**Review groups section:**

Each `ReviewGroup` renders as a collapsible row:

```tsx
{reviewGroups.map(group => {
  const state = groupApprovals.get(group.groupKey) ?? { approved: false };
  const isExpanded = group.confidence !== "high" || !state.approved;
  const confidenceColors = {
    high:   "bg-green-100 text-green-800 border-green-200",
    medium: "bg-amber-100 text-amber-800 border-amber-200",
    low:    "bg-red-100   text-red-800   border-red-200",
  };
  const confidenceLabel = { high: "ALTA", medium: "MEDIA", low: "BAJA" };

  return (
    <div key={group.groupKey} className="border border-neutral-200">
      {/* Group header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-neutral-50">
        <input
          type="checkbox"
          checked={state.approved}
          onChange={e => setGroupApprovals(prev => {
            const next = new Map(prev);
            next.set(group.groupKey, { ...state, approved: e.target.checked });
            return next;
          })}
          className="h-4 w-4 border-neutral-300"
        />
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium text-neutral-900">
            {/* Display labels resolved from NAV_ITEMS via allPairs */}
            {allPairs.find(p =>
              p.categoria === (state.overrideCategoria ?? group.suggestedCategoria) &&
              p.subcategoria === (state.overrideSubcategoria ?? group.suggestedSubcategoria)
            )?.label ?? `${group.suggestedCategoria}/${group.suggestedSubcategoria}`}
          </span>
          <span className={`ml-2 inline-block px-1.5 py-0.5 text-[10px] border
                            font-medium tracking-wide ${confidenceColors[group.confidence]}`}>
            {confidenceLabel[group.confidence]}
          </span>
        </div>
        <span className="text-xs text-neutral-400 shrink-0">
          {group.products.length} productos
        </span>
      </div>

      {/* Expanded body */}
      {isExpanded && (
        <div className="px-4 pb-3 pt-2 space-y-3 border-t border-neutral-100">
          {/* Category override */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-neutral-500 shrink-0">Categoría:</label>
            <select
              value={state.overrideCategoria ?? group.suggestedCategoria}
              onChange={e => {
                const cat = e.target.value;
                // Reset subcategoria to first available for new categoria
                const firstSub = allPairs.find(p => p.categoria === cat)?.subcategoria ?? "";
                setGroupApprovals(prev => {
                  const next = new Map(prev);
                  next.set(group.groupKey, {
                    ...state,
                    overrideCategoria:    cat,
                    overrideSubcategoria: firstSub,
                  });
                  return next;
                });
              }}
              className="text-xs border border-neutral-200 px-2 py-1 bg-white"
            >
              {/* Unique categoria values */}
              {[...new Set(allPairs.map(p => p.categoria))].map(cat => (
                <option key={cat} value={cat}>
                  {NAV_ITEMS.find(n => n.href === `/productos/${cat}`)?.label ?? cat}
                </option>
              ))}
            </select>

            <span className="text-neutral-300">›</span>

            <select
              value={state.overrideSubcategoria ?? group.suggestedSubcategoria}
              onChange={e => setGroupApprovals(prev => {
                const next = new Map(prev);
                next.set(group.groupKey, { ...state, overrideSubcategoria: e.target.value });
                return next;
              })}
              className="text-xs border border-neutral-200 px-2 py-1 bg-white"
            >
              {allPairs
                .filter(p => p.categoria === (state.overrideCategoria ?? group.suggestedCategoria))
                .map(p => (
                  <option key={p.subcategoria} value={p.subcategoria}>{p.label.split(" › ")[1]}</option>
                ))}
            </select>
          </div>

          {/* Product list (max 10, then "ver más") */}
          <div className="space-y-0.5">
            {group.products.slice(0, 10).map(p => (
              <div key={p.slug} className="text-xs text-neutral-600 truncate">
                {p.nombre.slice(0, 60)}{p.nombre.length > 60 ? "…" : ""}
              </div>
            ))}
            {group.products.length > 10 && (
              <div className="text-xs text-neutral-400">
                + {group.products.length - 10} más
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
})}
```

**Bottom action bar:**

```tsx
{/* Summary */}
<div className="border border-neutral-200 p-3 bg-neutral-50 text-sm text-neutral-600">
  {nuevos.length} nuevos · {gaps.newBrands.length} marcas nuevas · {gaps.unmappedCategories.length} categorías sin mapear
</div>

{/* Actions */}
<div className="flex items-center justify-between gap-4">
  <button
    onClick={() => setFase("listo")}
    className="text-xs text-neutral-500 underline underline-offset-2 hover:text-neutral-900"
  >
    ← Volver
  </button>
  <button
    onClick={handlePublicarAprobados}
    disabled={
      fase === "publicando" ||
      [...groupApprovals.values()].every(s => !s.approved)
    }
    className="px-6 py-2.5 bg-neutral-900 text-white text-xs tracking-widest uppercase
               hover:bg-neutral-700 disabled:opacity-40 transition-colors"
  >
    {fase === "publicando"
      ? "Publicando…"
      : `Publicar aprobados (${
          [...groupApprovals.entries()]
            .filter(([, s]) => s.approved)
            .reduce((sum, [key]) => {
              const g = reviewGroups.find(r => r.groupKey === key);
              return sum + (g?.products.length ?? 0);
            }, 0)
        })`
    }
  </button>
</div>
```

### 3.9 Smart result display

After `publicarAprobados` returns, show a result card (in addition to the existing resumen):

```tsx
{smartResult && (
  <div className="p-4 border border-green-200 bg-green-50 space-y-2">
    <p className="text-sm font-medium text-green-800">
      ✅ {smartResult.ok} productos publicados
    </p>
    {smartResult.brandsCreated.length > 0 && (
      <p className="text-xs text-green-700">
        Marcas creadas: {smartResult.brandsCreated.join(", ")}
      </p>
    )}
    {smartResult.seoTriggered.length > 0 && (
      <p className="text-xs text-green-700">
        SEO generado para {smartResult.seoTriggered.length} productos
      </p>
    )}
    {smartResult.notFound.length > 0 && (
      <p className="text-xs text-amber-700">
        {smartResult.notFound.length} productos no encontrados en WooCommerce
      </p>
    )}
  </div>
)}
```

---

## 4. File Change Summary

| File | Type | Change |
|---|---|---|
| `lib/category-suggester.ts` | **NEW** | `suggestCategory()` + `getAllCategoriaPairs()` |
| `actions/importar.ts` | **MODIFIED** | (1) Add `wooCategories` to `ProductoDiff`; (2) Add `gaps: DiffGaps` to `calcularDiff` return; (3) Add `publicarAprobados` + private helpers `extractBrandName` / `detectNewBrands`; (4) Add 5 new exported interfaces |
| `components/admin/ImportarPanel.tsx` | **MODIFIED** | New `"revisando"` / `"publicando"` phases; 4 new state variables; `buildReviewGroups()` helper; `handleRevisar()`, `handlePublicarAprobados()` handlers; review screen JSX; smart result card |
| `supabase/migrations/` | **NONE** | No schema changes needed |

---

## 5. Implementation Risks

| Risk | Severity | Mitigation |
|---|---|---|
| `WooCommerce categories` object shape varies — `p.categories` may not carry `name` in the `calcularDiff` paginated fetch (depends on WooCommerce API response fields) | **HIGH** | In `calcularDiff`, the paginated fetch already uses `per_page=100` with no `_fields` filter, so `categories[].name` should be present. Verify once in dev; add explicit field to fetch URL if absent. |
| `generateSEO` signature unknown — design assumes `generateSEO(producto)` returns a Promise; actual signature may differ | **MEDIUM** | Read `lib/seo-generator.ts` before implementing Step F. Wrap in a try/catch per product regardless. |
| `productos_padre` CHECK constraint on `seo_title` (≤ 60 chars) already handled in `aplicarCambios` — must replicate in `publicarAprobados` | **MEDIUM** | Design explicitly includes `slice(0, 60 - suffix.length)` — verify constraint value matches. |
| `marca_id` FK nullable — if `marcas` upsert skips a duplicate (ignoreDuplicates), re-fetching all slugs compensates; but the re-fetch adds one extra Supabase round-trip per `publicarAprobados` call | **LOW** | Acceptable for an admin action. Alternative: use `upsert(...).select()` to get returned IDs, but `ignoreDuplicates: true` suppresses row return for skipped rows. The re-fetch is the safe path. |
| Client-side `buildReviewGroups` skips products whose wooCategories are all in `WOO_CAT_MAP` — these products are imported via the existing fast path and not shown in the review screen, which may confuse admins who expect to see all new products | **LOW** | Spec defines this as intentional. Consider adding a collapsible "Ya mapeados (N)" section in the review screen in v2. |
| Dynamic import of `category-suggester` inside `calcularDiff` may cause slight cold-start delay on first run | **LOW** | Switch to static import at top of file once circular dependency risk is verified as absent. |

---

## Result

- **status**: success
- **executive_summary**: The design grounds every spec interface in the existing codebase patterns — `aplicarCambios` structure is replicated in `publicarAprobados`, the scorer reuses the already-loaded `NAV_ITEMS` constant, and the component extends the existing `fase` state machine without breaking the current fast path. The two highest-priority risks (WooCommerce category name availability and `generateSEO` signature) require one-line verifications before implementation begins and are flagged explicitly for the apply phase.
- **artifacts**: `openspec/changes/smart-import/design.md`
- **next_recommended**: sdd-tasks
- **risks**: see §5
- **skill_resolution**: paths-injected
