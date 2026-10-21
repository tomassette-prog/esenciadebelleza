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
