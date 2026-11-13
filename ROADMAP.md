# Roadmap

Pendientes que no bloquean el día a día. Cada punto indica qué hacer, por qué importa y qué pasa después solo.

## 1. Códigos EAN/GTIN para Google Merchant — prioridad ALTA

**Qué**: conseguir los códigos de barras de los productos para enviarlos en el feed de Google.

**Por qué**: sin GTIN, Google trata los productos de marca (Wella, L'Oréal, Fanola…) como genéricos y limita mucho sus impresiones en Shopping de pago. Los listados gratuitos siguen funcionando (`identifier_exists=false` es declaración legítima), pero el potencial de visibilidad está capado.

**Cómo, en orden de coste**:

1. **Pedirle los EANs al proveedor** (depeluqueriaproductos.com). Es la vía buena: es su carga de datos. Si los publica en su WooCommerce, **no hay que hacer nada más** — el sync los importa solo (`lib/woo-ean.ts` ya busca `_ean`, `ean`, `gtin`, `barcode`… en `meta_data`).
2. **Carga manual de los más vendidos** desde el admin (campo `ean_code` en la variación del producto). Si hay producto físico en tienda, escanear las cajas con el móvil son minutos por producto; 50 productos bien elegidos cubren el grueso del impacto.
3. **Bases de datos de pago** (BarcodeLookup, Go-UPC): solo tras una prueba de 50 productos — la cobertura de cosmética profesional suele ser incompleta y un GTIN equivocado hace que Google rechace el anuncio.

**Mensaje listo para el proveedor**:

> Hola, para publicar vuestros productos en Google Shopping necesitamos los códigos EAN/GTIN. ¿Podríais incluirlos en el campo de metadatos del producto en WooCommerce (clave `_ean`, o la que uséis para el código de barras)? Con que esté en la ficha del producto nos llega automáticamente a través de la sincronización que tenemos montada. Si os resulta más fácil, también nos vale un CSV con SKU y EAN y lo cargamos nosotros.

**Ya probado y descartado** (no reintentar):

- Leer el código de barras de las fotos del catálogo: prueba con 40 imágenes → 0 EANs (las fotos son de la cara frontal; el código va en la trasera).
- Galerías del proveedor: los 50 productos muestreados tienen **una única imagen**.
- Bases públicas "nombre → EAN": no existen para cosmética profesional (GS1/GEPIR funciona al revés).

**Cómo comprobar que funciona**: abrir `/feed/google-merchant.csv` y ver `identifier_exists=true` con el GTIN en la columna `gtin`.

---

## 2. Marca real de 10 productos — prioridad BAJA

Tras la limpieza de marcas genéricas (oct 2026) quedaron 10 productos cuya marca real no aparece en el nombre: líneas tipo MASK CARE, PRO YOU, MAN THERAPY, SUN CODE, KODE KONE, DECODE, VAN, EVA. También queda por unificar KEFUS / KENFUS (¿es la misma marca?).

**Qué**: decidir la marca real de cada uno (con conocimiento de producto) y asignarla en el admin. El trigger de la migración 040 ya impide que la importación vuelva a asignar marcas genéricas.

---

## 3. Revisar el primer ciclo de emails de conversión — prioridad MEDIA

Los tres flujos corren en el cron diario de las 03:30 (más avisos de reposición desde el webhook):

- Reseña post-pedido (3 días después de entregar).
- Recordatorio de carrito abandonado (2h después de llegar al pago).
- Aviso de reposición (cuando el proveedor repone stock).

**Qué**: tras los próximos pedidos reales, comprobar que los emails llegan bien, que el enlace de reseña funciona sin login y que la recuperación de carrito restaura el carrito. Los productos sin reseñas hoy se irán cubriendo solos.

---

## 4. Merchant Center: cerrar los errores de datos del feed — prioridad ALTA

Auditoría 2026-11-13 (cuenta 5816732573): 3.495 productos, 49 no aprobados (+41 esa semana por la caída de Vercel del 13-nov, HTTP 402 por facturación).

**Qué (pieza 1 — los 6 productos sin `[availability]`)**: son productos **sin variaciones activas en Supabase**. El tooling ya existe: el panel admin (`MerchantDiagnostico`) los lista como "🔴 Sin variaciones activas (availability)" y el botón **"Corregir todo"** de `MerchantCenterUploadSimple` los activa en Supabase. Ejecutar el diagnóstico y aplicar la corrección.

**Qué (pieza 2 — los 38 "Página de producto no disponible")**: herida directa de la caída del día 13. La web está arriba; Google los re-aprueba solo al re-rastrear. **No tocar nada**: solo verificar en 48-72h (revisar pestaña "Requiere atención") que el número baja de 38 a 0.

**Por qué**: cada producto no aprobado desaparece de los listados gratuitos de Shopping. Los 38 se curan solos; los 6 no (es un fallo de datos real).

**Cómo comprobar que funciona**: "Requiere atención" → 0 productos con "Falta el atributo [availability]" y la curva de "No aprobado" volviendo a ~8.

---

## 5. Merchant Center: mejoras de visibilidad — prioridad MEDIA

Propuestas por Google con datos de la competencia (auditoría 2026-11-13):

1. **Política de devoluciones** (decisión de negocio — Isabel): el "gasto de devolución" figura como **"Incompleto"**. La competencia directa (mmboutiquedelpeluquero.es, flap-articulosdepeluqueria.es, depeluqueriaproductos.com) ofrece **14 días + envío de devolución 0 €**; Google recomienda igualarlo para aumentar tráfico. Si se decide, actualizar la política en la web Y en "Envíos y devoluciones" de Merchant Center.
2. **179 productos de champú y acondicionador con descripciones incompletas**: completarlas desde el admin (mejor descripción = más visibilidad en búsquedas). Candidato natural para automatizar con verificación humana.
3. **Vincular PayPal** en Merchant Center (señal de confianza para compradores).
4. *Opcional*: vincular Google Ads solo si se decide invertir en anuncios (hoy no está vinculada ninguna cuenta — no es un error).

**Dato de partida**: 199 clics en 28 días (-19,8 % vs periodo anterior, en parte por la caída). Vigilar la recuperación en la misma revisión de 48-72h del punto 4.

---

## 6. Redirección 301 de `www` al dominio sin `www` — prioridad BAJA

El 13-11 se arregló el DNS (`www` apuntaba al hosting antiguo de DonDominio) y ahora `www.esenciadebelleza.es` sirve la web **directamente** en vez de redirigir. El canonical ya consolida en `https://esenciadebelleza.es` (sin impacto SEO inmediato), pero lo limpio es una redirección 301 `www → apex` (middleware de Next o `vercel.json`) para que exista una única URL canónica real.
