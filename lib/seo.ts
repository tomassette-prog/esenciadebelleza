import type { ProductoCompleto, ProductoVariacion } from "@/types/producto";

// ─── Helpers para generateMetadata de Next.js ─────────────────────────────────

const SITE_NAME = "Esencia de Belleza";
const BASE_URL = "https://esenciadebelleza.es";

export function buildProductoMetadata(
  producto: ProductoCompleto,
  variacionSeleccionada?: ProductoVariacion | null
) {
  const canonicalUrl = `${BASE_URL}/productos/${slugifyCategoria(producto.categoria)}/${slugifyCategoria(producto.subcategoria ?? "general")}/${producto.slug}`;

  // Si hay variación en la URL, el título muta para long-tail
  let title = producto.seo_title ?? `${producto.nombre} | ${SITE_NAME}`;
  let description =
    producto.seo_description ??
    `Compra ${producto.nombre} en ${SITE_NAME}. Envío rápido y precios competitivos.`;

  if (variacionSeleccionada) {
    const marca = producto.marca?.nombre ?? "";
    title = `${marca ? `${marca} ` : ""}${producto.nombre} ${variacionSeleccionada.nombre_variacion} | ${SITE_NAME}`;
    title = title.slice(0, 60);
    description = `Compra ${producto.nombre} en tono ${variacionSeleccionada.nombre_variacion}. Precio: ${formatPrice(variacionSeleccionada.precio_b2c)}. Envío rápido en España.`;
    description = description.slice(0, 155);
  }

  // Precio mínimo para Open Graph
  const precioDesde =
    producto.variaciones.length > 0
      ? Math.min(...producto.variaciones.map((v) => v.precio_b2c))
      : null;

  const imagenOg =
    variacionSeleccionada?.imagen_url ?? producto.imagen_principal_url;

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: SITE_NAME,
      images: imagenOg ? [{ url: imagenOg, width: 800, height: 800 }] : [],
      locale: "es_ES",
      type: "website",
    },
    other: {
      "product:price:amount": precioDesde?.toString() ?? "",
      "product:price:currency": "EUR",
    },
  };
}

export function buildCategoriaMetadata(categoria: string, subcategoria?: string) {
  const nombre = subcategoria
    ? `${formatCategoryName(subcategoria)} — ${formatCategoryName(categoria)}`
    : formatCategoryName(categoria);
  const title = `${nombre} | ${SITE_NAME}`.slice(0, 60);
  const description = `Descubre toda la gama de ${nombre.toLowerCase()} en ${SITE_NAME}. Productos profesionales con los mejores precios.`.slice(0, 155);

  return { title, description };
}

// ─── JSON-LD schemas ──────────────────────────────────────────────────────────

// 14 días naturales de desistimiento, devolución por correo a cargo del cliente
// (conforme a la página /devoluciones del sitio)
const RETURN_POLICY = {
  "@type": "MerchantReturnPolicy",
  applicableCountry: "ES",
  returnPolicyCategory:
    "https://schema.org/MerchantReturnFiniteReturnWindow",
  merchantReturnDays: 14,
  returnMethod: "https://schema.org/ReturnByMail",
  returnFees: "https://schema.org/ReturnShippingFees",
  returnPolicySeasonalOverride: [],
};

// Envío estándar: 5 € (gratis desde 40 € en Península); entrega 24 h express
// (conforme a la página /envios del sitio — zona Península)
const SHIPPING_DETAILS = {
  "@type": "OfferShippingDetails",
  shippingRate: {
    "@type": "MonetaryAmount",
    value: "5.00",
    currency: "EUR",
  },
  shippingDestination: {
    "@type": "DefinedRegion",
    addressCountry: "ES",
  },
  deliveryTime: {
    "@type": "ShippingDeliveryTime",
    handlingTime: {
      "@type": "QuantitativeValue",
      minValue: 0,
      maxValue: 0,
      unitCode: "DAY",
    },
    transitTime: {
      "@type": "QuantitativeValue",
      minValue: 1,
      maxValue: 2,
      unitCode: "DAY",
    },
  },
};

export function buildProductJsonLd(producto: ProductoCompleto) {
  // Imagen principal: intentar imagen del producto, luego primera variación con imagen
  const imagenPrincipal =
    producto.imagen_principal_url ??
    producto.variaciones.find((v) => v.imagen_url)?.imagen_url ??
    null;

  const offers = producto.variaciones.map((v) => ({
    "@type": "Offer",
    sku: v.sku,
    name: v.nombre_variacion,
    price: v.precio_b2c.toFixed(2),
    priceCurrency: "EUR",
    availability:
      v.stock > 0
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
    url: `${BASE_URL}/productos/${slugifyCategoria(producto.categoria)}/${slugifyCategoria(producto.subcategoria ?? "general")}/${producto.slug}?variacion=${encodeURIComponent(v.sku)}`,
    image: v.imagen_url ?? imagenPrincipal,
    seller: { "@type": "Organization", name: SITE_NAME },
    hasMerchantReturnPolicy: RETURN_POLICY,
    shippingDetails: SHIPPING_DETAILS,
  }));

  const rawDescription = stripHtml(producto.descripcion_general ?? "");
  // Google recomienda descripciones entre 50 y 5000 caracteres
  const description = rawDescription.slice(0, 5000) || producto.nombre;

  const marcaNombre = producto.marca?.nombre;

  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org/",
    "@type": "Product",
    name: producto.nombre,
    description,
    ...(imagenPrincipal ? { image: imagenPrincipal } : {}),
    ...(marcaNombre ? { brand: { "@type": "Brand", name: marcaNombre } } : {}),
    offers: (() => {
      if (offers.length === 1) return offers[0];
      const precios = producto.variaciones.map((v) => v.precio_b2c);
      const lowPrice = Math.min(...precios).toFixed(2);
      const highPrice = Math.max(...precios).toFixed(2);
      return {
        "@type": "AggregateOffer",
        offerCount: offers.length,
        lowPrice,
        highPrice,
        priceCurrency: "EUR",
        hasMerchantReturnPolicy: RETURN_POLICY,
        shippingDetails: SHIPPING_DETAILS,
        offers,
      };
    })(),
  };

  return jsonLd;
}

export function buildBreadcrumbJsonLd(
  categoria: string,
  subcategoria: string | null,
  productoNombre?: string,
  productoSlug?: string
) {
  const items: { name: string; url: string }[] = [
    { name: "Inicio", url: BASE_URL },
    {
      name: formatCategoryName(categoria),
      url: `${BASE_URL}/productos/${slugifyCategoria(categoria)}`,
    },
  ];

  if (subcategoria) {
    items.push({
      name: formatCategoryName(subcategoria),
      url: `${BASE_URL}/productos/${slugifyCategoria(categoria)}/${slugifyCategoria(subcategoria)}`,
    });
  }

  if (productoNombre && productoSlug) {
    items.push({
      name: productoNombre,
      url: `${BASE_URL}/productos/${slugifyCategoria(categoria)}/${slugifyCategoria(subcategoria ?? "general")}/${productoSlug}`,
    });
  }

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function buildOrganizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: BASE_URL,
    logo: `${BASE_URL}/logo.png`,
    sameAs: [],
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer service",
      availableLanguage: "Spanish",
    },
  };
}

// ─── Breadcrumb genérico (acepta array de items) ────────────────────────────
export function buildBreadcrumbJsonLdItems(
  items: { name: string; url: string }[]
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

// ─── Utilidades ───────────────────────────────────────────────────────────────

export function slugifyCategoria(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

export function formatCategoryName(slug: string): string {
  return slug
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatPrice(price: number, currency = "EUR"): string {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency,
  }).format(price);
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
