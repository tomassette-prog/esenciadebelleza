import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildProductoMetadata,
  buildProductJsonLd,
  buildBreadcrumbJsonLd,
  slugifyCategoria,
  formatPrice,
} from "@/lib/seo";
import { getResenas, getResenaAggregate } from "@/actions/resenas";
import { AnadirAlCarritoBtn } from "@/components/producto/AnadirAlCarritoBtn";
import { FormularioResena } from "@/components/producto/FormularioResena";
import { ListaResenas } from "@/components/producto/ListaResenas";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { BotonesCompartir } from "@/components/layout/BotonesCompartir";
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
        (v: { nombre_variacion: string; activa: boolean; precio_b2c: number }) =>
          v.activa && v.precio_b2c > 0 && v.nombre_variacion.toLowerCase() === decodeURIComponent(tono).toLowerCase()
      ) ?? null
    : null;

  return buildProductoMetadata(producto as ProductoCompleto, variacionSeleccionada);
}

// ─── Page Component (Server Component) ───────────────────────────────────────
export default async function ProductoPage({ params, searchParams }: PageProps) {
  const { slug, categoria, subcategoria } = await params;
  const { tono } = await searchParams;

  const supabase = await createClient();
  const supabaseAdmin = createAdminClient();
  const [{ data: producto, error }, { data: { user } }] = await Promise.all([
    supabaseAdmin
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

  // Reseñas
  const [resenas, aggregate] = await Promise.all([
    getResenas(p.id),
    getResenaAggregate(p.id),
  ]);

  // Solo considerar variaciones activas con precio válido
  const varsActivas = p.variaciones.filter((v) => v.activa && v.precio_b2c > 0);

  // Variación activa por query param o primera disponible con precio válido
  const variacionActiva =
    (tono
      ? varsActivas.find(
          (v) => v.nombre_variacion.toLowerCase() === decodeURIComponent(tono).toLowerCase()
        )
      : null)
    ?? varsActivas.sort((a, b) => b.precio_b2c - a.precio_b2c)[0]
    ?? p.variaciones.find((v) => v.activa)
    ?? null;

  // URL canónica siempre apunta al padre — evita duplicate content
  const canonicalUrl = `https://esenciadebelleza.es/productos/${slugifyCategoria(categoria)}/${slugifyCategoria(subcategoria)}/${slug}`;

  // JSON-LD schemas
  const productJsonLd = buildProductJsonLd(p, aggregate ?? undefined);
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
            {/* Imagen principal — next/image para LCP optimizado (WebP/AVIF auto) */}
            <div className="aspect-square bg-neutral-50 overflow-hidden relative">
              <Image
                src={variacionActiva?.imagen_url ?? p.imagen_principal_url ?? "/placeholder.webp"}
                alt={`${p.nombre}${variacionActiva ? ` — ${variacionActiva.nombre_variacion}` : ""}`}
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-contain"
                priority
                unoptimized
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
                {variacionActiva.precio_b2c <= 0 ? (
                  <a
                    href={`https://wa.me/34604825305?text=${encodeURIComponent(`Hola, me gustaría consultar el precio de ${p.nombre}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-lg font-medium text-[#25D366] hover:text-[#1da851] transition-colors"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                    </svg>
                    Consultar precio por WhatsApp
                  </a>
                ) : b2bAprobado && variacionActiva.precio_b2b && variacionActiva.precio_b2b > 0 ? (
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
                    <span className="text-xs tracking-wider uppercase text-[#7A4A40]">
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
            {variacionActiva && variacionActiva.precio_b2c > 0 && variacionActiva.stock > 0 ? (
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
            ) : variacionActiva && variacionActiva.precio_b2c > 0 && variacionActiva.stock <= 0 ? (
              <a
                href={`https://wa.me/34604825305?text=${encodeURIComponent(`Hola, me gustaría consultar la disponibilidad de ${p.nombre}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 w-full py-4 rounded-lg bg-[#25D366] text-white font-medium hover:bg-[#1da851] transition-colors"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                </svg>
                Consultar disponibilidad por WhatsApp
              </a>
            ) : variacionActiva && variacionActiva.precio_b2c <= 0 ? (
              <a
                href={`https://wa.me/34604825305?text=${encodeURIComponent(`Hola, me gustaría consultar el precio de ${p.nombre}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 w-full py-4 rounded-lg bg-[#25D366] text-white font-medium hover:bg-[#1da851] transition-colors"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                </svg>
                Consultar precio por WhatsApp
              </a>
            ) : null}

            {/* Descripción */}
            {p.descripcion_general && (
              <div
                className="prose prose-sm prose-neutral max-w-none text-neutral-600 border-t border-neutral-100 pt-6"
                dangerouslySetInnerHTML={{ __html: p.descripcion_general }}
              />
            )}

            {/* SEO enriquecido */}
            {p.texto_enriquecido_seo && (
              <div
                className="prose prose-sm prose-neutral max-w-none text-neutral-500 text-sm border-t border-neutral-100 pt-6"
                dangerouslySetInnerHTML={{ __html: p.texto_enriquecido_seo }}
              />
            )}

            {/* Compartir */}
            <div className="border-t border-neutral-100 pt-6">
              <BotonesCompartir
                url={`https://esenciadebelleza.es/productos/${slugifyCategoria(p.categoria)}/${slugifyCategoria(p.subcategoria ?? "general")}/${p.slug}`}
                titulo={p.nombre}
                descripcion={p.descripcion_general?.replace(/<[^>]+>/g, "").slice(0, 160) ?? ""}
                imagen={p.imagen_principal_url ?? ""}
              />
            </div>
          </div>
        </div>

        {/* ── Reseñas ── */}
        <section className="mt-16 border-t border-neutral-100 pt-12">
          <h2
            className="text-2xl font-light text-neutral-900 mb-8"
            style={{ fontFamily: "var(--font-cormorant)" }}
          >
            Opiniones de clientes
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <ListaResenas resenas={resenas} aggregate={aggregate} />
            <div>
              <h3 className="text-base font-medium text-neutral-900 mb-4">
                Escribe tu reseña
              </h3>
              <FormularioResena productoId={p.id} user={user} />
            </div>
          </div>
        </section>
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
