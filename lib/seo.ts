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

export function buildProductJsonLd(producto: ProductoCompleto) {
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
    image: v.imagen_url ?? producto.imagen_principal_url,
    seller: { "@type": "Organization", name: SITE_NAME },
  }));

  return {
    "@context": "https://schema.org/",
    "@type": "Product",
    name: producto.nombre,
    description: stripHtml(producto.descripcion_general ?? ""),
    image: producto.imagen_principal_url,
    brand: {
      "@type": "Brand",
      name: producto.marca?.nombre ?? "",
    },
    offers:
      offers.length === 1
        ? offers[0]
        : { "@type": "AggregateOffer", offers, priceCurrency: "EUR" },
  };
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
