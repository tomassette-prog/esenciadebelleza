import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildProductoMetadata,
  buildProductJsonLd,
  buildBreadcrumbJsonLd,
  slugifyCategoria,
  formatPrice,
} from "@/lib/seo";
import { AnadirAlCarritoBtn } from "@/components/producto/AnadirAlCarritoBtn";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import type { ProductoCompleto } from "@/types/producto";

// ─── Tipos de parámetros de la ruta ──────────────────────────────────────────
interface PageProps {
  params: Promise<{
    categoria: string;
    subcategoria: string;
    slug: string;
  }>;
  searchParams: Promise<{ tono?: string; variacion?: string }>;
}

// ─── ISR: regenerar cada 1 hora ──────────────────────────────────────────────
export const revalidate = 3600;

// ─── generateStaticParams: pre-renderizar los más populares (ISR) ────────────
export async function generateStaticParams() {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("productos_padre")
    .select("slug, categoria, subcategoria")
    .eq("activo", true)
    .limit(200); // Pre-render solo los primeros 200

  return (data ?? []).map((p) => ({
    categoria: slugifyCategoria(p.categoria),
    subcategoria: slugifyCategoria(p.subcategoria ?? "general"),
    slug: p.slug,
  }));
}

// ─── generateMetadata ─────────────────────────────────────────────────────────
export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const { tono } = await searchParams;

  const supabase = await createClient();
  const { data: producto } = await supabase
    .from("productos_padre")
    .select("*, marca:marcas(*), variaciones:productos_variaciones(*)")
    .eq("slug", slug)
    .eq("activo", true)
    .single();

  if (!producto) return { title: "Producto no encontrado" };

  const variacionSeleccionada = tono
    ? producto.variaciones?.find(
        (v: { nombre_variacion: string }) =>
          v.nombre_variacion.toLowerCase() === decodeURIComponent(tono).toLowerCase()
      ) ?? null
    : null;

  return buildProductoMetadata(producto as ProductoCompleto, variacionSeleccionada);
}

// ─── Page Component (Server Component) ───────────────────────────────────────
export default async function ProductoPage({ params, searchParams }: PageProps) {
  const { slug, categoria, subcategoria } = await params;
  const { tono } = await searchParams;

  const supabase = await createClient();
  const [{ data: producto, error }, { data: { user } }] = await Promise.all([
    supabase
      .from("productos_padre")
      .select("*, marca:marcas(*), variaciones:productos_variaciones(*)")
      .eq("slug", slug)
      .eq("activo", true)
      .single(),
    supabase.auth.getUser(),
  ]);

  if (error || !producto) notFound();

  // Comprobar si el usuario es profesional aprobado
  let b2bAprobado = false;
  if (user) {
    const { data: perfil } = await supabase
      .from("perfiles_usuario")
      .select("b2b_aprobado, tipo_cliente")
      .eq("id", user.id)
      .single();
    b2bAprobado = perfil?.tipo_cliente === "b2b" && perfil?.b2b_aprobado === true;
  }

  const p = producto as ProductoCompleto;

  // Variación activa por query param o primera disponible
  const variacionActiva =
    (tono
      ? p.variaciones.find(
          (v) => v.nombre_variacion.toLowerCase() === decodeURIComponent(tono).toLowerCase()
        )
      : null) ?? p.variaciones.find((v) => v.activa) ?? p.variaciones[0] ?? null;

  // URL canónica siempre apunta al padre — evita duplicate content
  const canonicalUrl = `https://esenciadebelleza.es/productos/${slugifyCategoria(categoria)}/${slugifyCategoria(subcategoria)}/${slug}`;

  // JSON-LD schemas
  const productJsonLd = buildProductJsonLd(p);
  const breadcrumbJsonLd = buildBreadcrumbJsonLd(
    p.categoria,
    p.subcategoria,
    p.nombre,
    p.slug
  );

  return (
    <>
      {/* ── Canonical inalterable hacia la URL padre ── */}
      <link rel="canonical" href={canonicalUrl} />

      {/* ── JSON-LD Rich Snippets ── */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      <div className="container-main py-8 lg:py-16">
        {/* ── Breadcrumb ── */}
        <Breadcrumb
          items={[
            { label: p.categoria, href: `/productos/${slugifyCategoria(p.categoria)}` },
            ...(p.subcategoria
              ? [{ label: p.subcategoria, href: `/productos/${slugifyCategoria(p.categoria)}/${slugifyCategoria(p.subcategoria)}` }]
              : []),
            { label: p.nombre },
          ]}
          className="mb-8"
        />

        {/* ── Contenido del producto ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20">
          {/* Galería */}
          <div className="space-y-4">
            {/* Imagen principal con priority para LCP */}
            <div className="aspect-square bg-neutral-50 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={variacionActiva?.imagen_url ?? p.imagen_principal_url ?? "/placeholder.webp"}
                alt={`${p.nombre}${variacionActiva ? ` — ${variacionActiva.nombre_variacion}` : ""}`}
                className="w-full h-full object-contain"
                loading="eager"     // above the fold = priority
                decoding="async"
                width={800}
                height={800}
              />
            </div>
          </div>

          {/* Info */}
          <div className="flex flex-col gap-6">
            {/* Marca */}
            {p.marca && (
              <p className="text-xs tracking-widest uppercase text-neutral-400">
                {p.marca.nombre}
              </p>
            )}

            {/* Nombre */}
            <h1
              className="text-3xl lg:text-4xl font-light text-neutral-900 leading-tight"
              style={{ fontFamily: "var(--font-cormorant)" }}
            >
              {p.nombre}
              {variacionActiva && (
                <span className="block text-xl text-neutral-500 mt-1">
                  {variacionActiva.nombre_variacion}
                </span>
              )}
            </h1>

            {/* Precio */}
            {variacionActiva && (
              <div className="flex flex-col gap-1">
                {b2bAprobado && variacionActiva.precio_b2b && variacionActiva.precio_b2b > 0 ? (
                  <>
                    <div className="flex items-baseline gap-3">
                      <span className="text-2xl font-medium text-neutral-900">
                        {new Intl.NumberFormat("es-ES", {
                          style: "currency",
                          currency: "EUR",
                        }).format(variacionActiva.precio_b2b)}
                      </span>
                      <span className="text-sm text-neutral-400 line-through">
                        {new Intl.NumberFormat("es-ES", {
                          style: "currency",
                          currency: "EUR",
                        }).format(variacionActiva.precio_b2c)}
                      </span>
                    </div>
                    <span className="text-xs tracking-wider uppercase text-[#8B6914]">
                      Precio profesional B2B
                    </span>
                  </>
                ) : (
                  <div className="flex items-baseline gap-3">
                    <span className="text-2xl font-medium text-neutral-900">
                      {new Intl.NumberFormat("es-ES", {
                        style: "currency",
                        currency: "EUR",
                      }).format(variacionActiva.precio_b2c)}
                    </span>
                    {variacionActiva.precio_comparar &&
                      variacionActiva.precio_comparar > variacionActiva.precio_b2c && (
                        <span className="text-lg text-neutral-400 line-through">
                          {new Intl.NumberFormat("es-ES", {
                            style: "currency",
                            currency: "EUR",
                          }).format(variacionActiva.precio_comparar)}
                        </span>
                      )}
                  </div>
                )}
              </div>
            )}

            {/* Selector de variaciones */}
            {p.variaciones.length > 1 && (
              <VariacionSelectorServer
                variaciones={p.variaciones}
                variacionActivaId={variacionActiva?.id}
                slug={p.slug}
                categoria={slugifyCategoria(p.categoria)}
                subcategoria={slugifyCategoria(p.subcategoria ?? "general")}
              />
            )}

            {/* CTA */}
            {variacionActiva && (
              <AnadirAlCarritoBtn
                variacionId={variacionActiva.id}
                productoId={p.id}
                slug={p.slug}
                categoria={slugifyCategoria(p.categoria)}
                subcategoria={slugifyCategoria(p.subcategoria ?? "general")}
                nombre={`${p.nombre}${variacionActiva.nombre_variacion !== "Único" ? ` — ${variacionActiva.nombre_variacion}` : ""}`}
                nombreVariacion={variacionActiva.nombre_variacion}
                imagenUrl={variacionActiva.imagen_url ?? p.imagen_principal_url ?? null}
                precio={b2bAprobado && variacionActiva.precio_b2b && variacionActiva.precio_b2b > 0 ? variacionActiva.precio_b2b : variacionActiva.precio_b2c}
                sku={variacionActiva.sku}
              />
            )}

            {/* Descripción */}
            {p.descripcion_general && (
              <div
                className="prose prose-sm prose-neutral max-w-none text-neutral-600 border-t border-neutral-100 pt-6"
                dangerouslySetInnerHTML={{ __html: p.descripcion_general }}
              />
            )}

            {/* SEO enriquecido (visible en página pero orientado a bots) */}
            {p.texto_enriquecido_seo && (
              <div
                className="prose prose-sm prose-neutral max-w-none text-neutral-500 text-sm border-t border-neutral-100 pt-6"
                dangerouslySetInnerHTML={{ __html: p.texto_enriquecido_seo }}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Selector de variaciones (Server Component puro — sin JS cliente) ─────────
function VariacionSelectorServer({
  variaciones,
  variacionActivaId,
  slug,
  categoria,
  subcategoria,
}: {
  variaciones: ProductoCompleto["variaciones"];
  variacionActivaId?: string;
  slug: string;
  categoria: string;
  subcategoria: string;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs tracking-widest uppercase text-neutral-400">
        Selecciona una variación
      </p>
      <div className="flex flex-wrap gap-2">
        {variaciones.map((v) => (
          <a
            key={v.id}
            href={`/productos/${categoria}/${subcategoria}/${slug}?tono=${encodeURIComponent(v.nombre_variacion)}`}
            className={`px-3 py-2 text-xs border transition-colors ${
              v.id === variacionActivaId
                ? "border-neutral-900 bg-neutral-900 text-white"
                : "border-neutral-200 hover:border-neutral-900"
            }`}
          >
            {v.nombre_variacion}
          </a>
        ))}
      </div>
    </div>
  );
}
