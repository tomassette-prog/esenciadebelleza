# Campaña "Champú de Cebolla Anticaída" — Kit completo

> Deep search España (30/09/2026): demanda altísima + competencia batible + ventaja de precio 4x.
> Dato clave del mercado: Nuggela & Sulé (líder, 5.329 valoraciones) = 15,49 EUR / 250 ml = 6,20 EUR/100ml.
> Nosotros: 1,50 EUR/100ml (1L) y 1,23 EUR/100ml (pack). **Mensaje ancla: "1 L por menos de lo que otros pagan por 250 ml".**

## 1. Oferta

| SKU | PVP antes | PVP oferta | EUR/100ml |
|---|---|---|---|
| Pack Cebolla: Champú 1000 ml + Mascarilla 300 ml | 22,00 EUR | **19,90 EUR** | 1,23 |
| Champú Cebolla Revitalizante 1000 ml (suelto) | 14,95 EUR | **13,90 EUR** | 1,39 |

Escasez real: **7 días** (fecha fin de promoción explícita en la ficha y en Merchant).

## 2. Ficha y SEO (`lib/seo-generator.ts` + `lib/seo.ts`)

- **Title / H1**: `Pack Champú de Cebolla Anticaída 1L + Mascarilla 300ml — 19,90 EUR`
- **Slug**: `pack-cebolla-anticaida` (ficha real: `/packs/pack-cebolla-anticaida`)
- **Meta description**: `Pack anticaída de cebolla: champú 1000 ml + mascarilla 300 ml por 19,90 EUR. 1 litro por menos de lo que otros pagan por 250 ml. Envío gratis desde 49 EUR. Solo 7 días.`
- Palabras a incluir en el texto_enriquecido_seo: champú de cebolla, champú anticaída, cebolla roja, caída del pelo, fortalecer cabello, pack capilar barato, champú anticaída profesional, sin parabenos.
- Datos estructurados: Offer con `priceValidUntil` = fecha fin de promo.

## 3. Google Shopping / Performance Max (prioridad #1)

- Publicar `merchant-feed-oferta.csv` (o regenerar feed vía `actions/merchant-center.ts`) con `sale_price` y `price` originales → aparece la etiqueta "Oferta" (+20-30% CTR típico).
- Campaña **Performance Max**, solo España, 10-15 EUR/día, 15 días.
- Señales de audiencia / keywords: `champú de cebolla`, `champú anticaída`, `champú cebolla roja`, `champú anticaída barato`, `champú para la caída del pelo`, `champú de cebolla nuggela` (conquista de competencia).
- Asset group con el claim de precio como headline: "1 L por menos que 250 ml".

## 4. Email (base de clientes Supabase + `lib/email.ts`)

**Asunto**: 1 litro de champú de cebolla por menos de lo que pagan por 250 ml
**Cuerpo**: Pack anticaída 1000 ml + mascarilla 300 ml → 19,90 EUR (antes 22 EUR). El mismo tipo de producto que está arrasando en España, a 1,23 EUR/100ml. Solo 7 días. → CTA "Quiero mi pack"
Segmentación: clientes con pedidos previos de categoría capilar (tintes, champús, mascarillas).

## 5. Instagram Reels + TikTok (escala viral)

1. **"1L vs 250 ml"** — visual de las dos botellas + precio de Nuggela (15,49 EUR) vs el pack (19,90 EUR). Gancho: "esto no cuadra".
2. **Antes/Después** de caída del pelo (con consentimiento o UGC de micro-influencers).
3. **Unboxing del pack** + text overlay "pack anticaída más barato de España".
- Micro-influencers de belleza/pelo (5k-50k seguidores) a cambio de producto, 2-3 activaciones.

## 6. Blog (`actions/blog.ts`)

Post: **"Champú de cebolla: ¿realmente frena la caída del pelo?"** — captura la búsqueda informativa en auge, enlaza al pack con la oferta.

## 7. Calendario 7 días

| Día | Acción |
|---|---|
| 1-2 | Ficha + precios de oferta (script `_promo_cebolla.mjs`) + post SEO |
| 2 | Feed Merchant con sale_price + etiqueta promoción |
| 3 | Lanzar Performance Max (10-15 EUR/día) |
| 3-5 | 3 Reels/TikTok + envíos a micro-influencers |
| 5 | Email a base de clientes |
| 7 | Revisar ROAS → subir presupuesto al canal que convierta |

## 8. KPIs

- ROAS objetivo Performance Max: > 3 (margen lo permite con coste de producto bajo)
- CTR Shopping con etiqueta Oferta vs sin ella
- Ventas del pack en 7 días vs objetivo mínimo de rotación de stock
