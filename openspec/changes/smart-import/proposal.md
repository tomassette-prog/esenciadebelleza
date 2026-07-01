# Smart Import — Proposal

## Problem

The current import flow (`calcularDiff()` → apply) pushes products directly to Supabase with `activo=false`, but provides no structured way to handle two common gaps: (1) products from new WooCommerce brands that don't yet exist in the `marcas` table, and (2) products from WooCommerce categories not mapped in `WOO_CAT_MAP`. Today, admins must manually inspect the diff output, create brand records separately, update `lib/categorias.ts`, and re-run the import — a multi-step, error-prone process that scales poorly when importing 50+ products at once.

## Solution Overview

Enhance the import pipeline with a **Smart Review Step** between diff calculation and final apply. When the importer detects unknown brands or unmapped WooCommerce categories, it automatically:

1. Creates placeholder brand records in `marcas` (with `logo_url=null`) for review.
2. Suggests the most probable `categoria`/`subcategoria` for each unmapped WooCommerce category using keyword matching against the existing slugs in `lib/categorias.ts`.
3. Groups products by their suggested category and presents them in a bulk-review UI where the admin can approve, modify, or reject entire groups in one action.
4. On final approval, publishes all approved products (`activo=true`) and triggers SEO generation for those without `texto_enriquecido_seo`.

No products go live until the admin explicitly approves them. Categories remain hardcoded in `lib/categorias.ts`; the suggestion engine is keyword-based, not dynamic.

## User Stories

- **As an admin**, when I run "Calcular diff", I see not only the product count delta but also a summary of new brands and unmapped WooCommerce categories detected, so I know upfront what needs review.
- **As an admin**, I see a review screen that groups pending products by their suggested `categoria + subcategoria`, each group showing product count, brand, and the suggested mapping, so I can evaluate the suggestion in context.
- **As an admin**, I can bulk-approve a category group with one click, optionally change the suggested category/subcategoria before approving, or reject the entire group to exclude those products from this import run.
- **As an admin**, after completing the review and clicking "Publicar aprobados", all approved products are set to `activo=true` and SEO generation is triggered automatically for those lacking enriched SEO text — without any further manual steps.
- **As an admin**, new brands that were auto-created appear in the brands management section with a visual indicator ("sin logo") so I can upload their logo at my own pace, independently of the import flow.

## Business Rules

1. **Brand detection**: match product's `marca` field (from WooCommerce) against existing `nombre` slugs in `marcas` table (case-insensitive, normalized). If no match → auto-insert a new `marcas` record with `logo_url=null` and flag it in the review screen.
2. **Category suggestion algorithm**: keyword matching of the WooCommerce category name and product name tokens against existing `categoria` and `subcategoria` slugs defined in `lib/categorias.ts` (WOO_CAT_MAP + NAV_ITEMS). Scoring: exact slug match > partial token match > fallback to "sin-categoria". Always requires admin approval regardless of confidence.
3. **Bulk grouping**: products sharing the same suggested `categoria + subcategoria` are shown as a collapsible group. Each group has a single approve/reject toggle and an optional category override selector. Individual product overrides are out of scope for v1.
4. **Draft state**: all new and updated products remain `activo=false` throughout diff, review, and until the admin explicitly triggers "Publicar aprobados". Updates to existing active products do not change their `activo` status.
5. **SEO trigger**: on bulk-publish, for each newly approved product where `texto_enriquecido_seo IS NULL`, enqueue SEO generation using the existing `seo-generator` logic. This runs asynchronously; publish does not block on SEO completion.
6. **New brands**: auto-inserted to `marcas` during the apply step (not during diff), so they only appear if the admin approves at least one product from that brand. `logo_url` is set to `null`; a UI badge ("sin logo") appears in the brands admin list.

## Scope

### In scope

- Enhanced `calcularDiff()` that returns a `gaps` object: `{ newBrands: string[], unmappedCategories: { wooCat: string, suggestedCategoria: string, suggestedSubcategoria: string, confidence: 'high'|'medium'|'low' }[] }`.
- Keyword-based category suggestion utility in `lib/categorias.ts` (or a new `lib/category-suggester.ts`).
- New review UI step: either a sub-step within `ImportarPanel` or a dedicated `/admin/importar/revisar` page, rendering groups with approve/reject/override controls.
- Bulk approve/reject by category group, with optional `categoria + subcategoria` override per group.
- Auto-create new `marcas` records (with `logo_url=null`) on final apply for approved products.
- SEO auto-trigger on publish for products missing `texto_enriquecido_seo`.
- Visual indicator in brands admin list for brands without logo.
- Server Action `actions/importar.ts` updated to support the review payload (approved groups + category overrides).

### Out of scope (future)

- Dynamic category management from database (categories remain in `lib/categorias.ts`).
- AI-powered or embedding-based category suggestion — keyword matching is sufficient for v1.
- Logo auto-download or auto-search for new brands.
- Per-product category override in the review screen (group-level override only).
- Undo/rollback after bulk-publish.

## Risks

- **MEDIUM — Category suggestion accuracy**: keyword matching may mis-categorize novel or niche products (e.g., multi-category beauty tools). Mitigation: approval is always required; confidence indicator ("alta / media / baja") is shown per group so the admin can prioritize careful review of low-confidence suggestions.
- **LOW — Performance**: `calcularDiff()` already handles 3,000+ products; adding brand normalization and keyword scoring adds O(n) overhead with small constant factors. No pagination or background job needed for typical catalog sizes.
- **LOW — Brand name normalization**: WooCommerce brand names may differ in accents or casing from `marcas.nombre`. Mitigation: normalize both sides to lowercase + remove diacritics before comparison; surface the raw WooCommerce value alongside the matched/new brand in the review screen.

## Success Criteria

- Admin can import 50+ new products and fully categorize them using bulk group approval in under 5 minutes.
- Zero new products become publicly visible (`activo=true`) without an explicit admin approval action.
- New brands appear in the brands admin list (even without a logo) immediately after the import is approved and applied.
- SEO generation is triggered automatically for all newly published products, requiring no separate manual step.
