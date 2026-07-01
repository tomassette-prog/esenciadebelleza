# Esencia de Belleza — Instrucciones del proyecto

## Stack
- **Next.js 14.2** con App Router, React 18, TypeScript
- **Supabase** (Postgres + Auth + RLS) — project ID: `yjanobsfzcwpusynvlun`
- **Tailwind CSS** — colores: rosa `#C4857A`, marrón `#3D2018`
- **Stripe** (live mode) + **Cecabank TPV** + **PayPal SmartButtons**
- **Vercel** → `esenciadebelleza.es`

## Estructura de carpetas
- `app/(main)/` — páginas públicas (home, productos, blog, checkout, etc.)
- `app/admin/` — panel de administración (protegido por whitelist de email)
- `app/api/` — rutas API (Stripe, Cecabank, webhooks)
- `actions/` — Server Actions de Next.js
- `components/` — dividido en `admin/`, `carrito/`, `checkout/`, `layout/`, `producto/`
- `lib/` — utilidades (supabase, stripe, cecabank, seo, email)
- `scripts/` — scripts de importación y utilidades (ts-node)
- `supabase/migrations/` — migraciones SQL numeradas

## Tablas Supabase clave
- `productos_padre` — 3046 productos (NO existe tabla `productos`)
- `productos_variaciones` — precio_b2c, activa, stock
- `config_tienda` — clave/valor: envio_gratis_desde, envio_coste, precio_multiplicador_b2c/b2b
- `marcas` — tiene `logo_url` pero NO tiene columna `descripcion`
- `categorias`, `pedidos`, `resenas`, `posts`, `profesionales`

## Patrones de código importantes
- `createClient()` = cliente anon SSR (no puede leer sesión browser sin fix manual)
- `createAdminClient()` = service_role, usar para páginas públicas que necesiten datos sin RLS
- Stock filtering: `.select(...variaciones:productos_variaciones!inner(...)).gt("variaciones.stock", 0)`
- Sin `.limit()` explícito → Supabase devuelve máximo 1000 filas
- Paginación: siempre usar `.range(from, to)` en listas grandes
- `force-dynamic` + `revalidate=0` en páginas de marcas y admin

## Auth
- Login: `supabase.auth.signInWithPassword()` + `window.location.href` (NO router.push)
- Admin layout lee cookie `sb-yjanobsfzcwpusynvlun-auth-token` y parsea JWT manualmente
- Admin whitelist: `ADMIN_EMAILS = ["ziarresamot@gmail.com"]`

## Convenciones
- Server Actions en `/actions/*.ts` con `"use server"` al inicio
- Client components solo cuando necesario (`"use client"`)
- Imágenes con `next/image`, siempre incluir `priority` en LCP (ficha producto)
- SEO: usar `lib/seo.ts` para metadatos y `lib/seo-generator.ts` para enriquecer con IA
- No usar `descripcion` en queries a tabla `marcas` (columna no existe)
- Rutas dinámicas de marcas: `dynamicParams = true`

## Scripts npm útiles
```bash
npm run dev                  # servidor local
npm run import:woo           # importar productos desde WooCommerce
npm run seo:batch            # generar SEO para productos sin texto_enriquecido_seo
npm run seo:batch:todos      # regenerar SEO de todos los productos
npm run migrate:imagenes     # migrar imágenes a Supabase Storage
```

## Pagos
- **Stripe**: `app/api/stripe/checkout/route.ts` → crea sesión y redirige
- **Cecabank**: `lib/cecabank.ts` firma SHA-2 → `actions/checkout.ts`
- **PayPal**: `components/checkout/PaypalSmartButtons.tsx`
- Confirmación unificada en `app/(main)/checkout/confirmacion/page.tsx`

## WooCommerce (fuente de verdad para stock)
- URL: `https://depeluqueriaproductos.com`
- Auth: Application Password `admin:pzzcxThjVHhCEtaO36UgyZ8N`
- Lanzar pedido: `POST /wp-json/esencia/v1/order` con header `X-Esencia-Token: eb_secret_esencia_2026`
