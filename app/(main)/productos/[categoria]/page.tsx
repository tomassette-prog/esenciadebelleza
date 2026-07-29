import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ProductoCard } from "@/components/producto/ProductoCard";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import {
  buildCategoriaMetadata,
  buildBreadcrumbJsonLd,
  slugifyCategoria,
  formatCategoryName,
} from "@/lib/seo";
import type { ProductoCatalogo } from "@/types/producto";
import Link from "next/link";

export const revalidate = 3600;

interface PageProps {
  params: Promise<{ categoria: string }>;
  searchParams: Promise<{ orden?: string; pagina?: string }>;
}

// ─── generateStaticParams: pre-renderizar todas las categorías ────────────────
export async function generateStaticParams() {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("productos_padre")
    .select("categoria")
    .eq("activo", true);

  const categorias = [...new Set((data ?? []).map((p) => p.categoria))];
  return categorias.map((cat) => ({ categoria: slugifyCategoria(cat) }));
}

// ─── generateMetadata ─────────────────────────────────────────────────────────
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { categoria } = await params;
  return buildCategoriaMetadata(categoria);
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default async function CategoriaPage({ params, searchParams }: PageProps) {
  const { categoria } = await params;
  const { orden = "nombre", pagina = "1" } = await searchParams;

  const BASE_URL = "https://esenciadebelleza.es";
  const PAGE_SIZE = 24;
  const page = Math.max(1, parseInt(pagina, 10));
  const from = (page - 1) * PAGE_SIZE;

  const supabase = await createClient();

  // Resolver slug → nombre real. Primero intenta con la muestra inicial, luego busca directamente.
  const { data: todasCats } = await supabase
    .from("productos_padre")
    .select("categoria")
    .eq("activo", true)
    .limit(1000);
  let categoriaNombre = [...new Set((todasCats ?? []).map((p) => p.categoria))]
    .find((c) => slugifyCategoria(c) === categoria);
  if (!categoriaNombre) {
    const { data: directCheck } = await supabase
      .from("productos_padre").select("categoria").eq("activo", true)
      .ilike("categoria", categoria).limit(1);
    if (directCheck?.[0]) categoriaNombre = directCheck[0].categoria;
  }

  if (!categoriaNombre) notFound();

  // Obtener subcategorías únicas dentro de esta categoría
  const { data: subcatData } = await supabase
    .from("productos_padre")
    .select("subcategoria")
    .eq("activo", true)
    .eq("categoria", categoriaNombre);

  const subcategorias = [
    ...new Set((subcatData ?? []).map((p) => p.subcategoria).filter(Boolean)),
  ] as string[];

  if (subcatData === null || subcatData.length === 0) notFound();

  // Obtener productos de la categoría (solo con stock > 0)
  let query = supabase
    .from("productos_padre")
    .select(
      `id, nombre, slug, categoria, subcategoria, oferta,
       imagen_principal_url, destacado, nuevo,
       marca:marcas(nombre),
       variaciones:productos_variaciones(precio_b2c, precio_comparar, activa, stock)`,
      { count: "exact" }
    )
    .eq("activo", true)
    .eq("variaciones.activa", true)
    .eq("categoria", categoriaNombre)
    .range(from, from + PAGE_SIZE - 1);

  if (orden === "precio-asc") query = query.order("nombre");
  else query = query.order("nombre");

  const { data, count } = await query;

  const productos: ProductoCatalogo[] = (data ?? []).map((p) => {
    const variacionesActivas = (p.variaciones ?? []).filter(
      (v: { activa: boolean }) => v.activa
    );
    const precioDesde =
      variacionesActivas.length > 0
        ? Math.min(...variacionesActivas.map((v: { precio_b2c: number }) => v.precio_b2c))
        : 0;
    const precioCompararDesde = variacionesActivas
      .map((v: { precio_comparar: number | null }) => v.precio_comparar)
      .filter((pc): pc is number => pc != null && pc > 0);
    return {
      id: p.id,
      nombre: p.nombre,
      slug: p.slug,
      categoria: p.categoria,
      subcategoria: p.subcategoria,
      imagen_principal_url: p.imagen_principal_url,
      destacado: p.destacado,
      nuevo: p.nuevo,
      marca_nombre: (p.marca as unknown as { nombre: string } | null)?.nombre ?? null,
      precio_desde: precioDesde,
      precio_comparar_desde: precioCompararDesde.length > 0 ? Math.min(...precioCompararDesde) : null,
      oferta: p.oferta ?? false,
      total_variaciones: variacionesActivas.length,
    };
  });

  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE);
  const categoriaLabel = formatCategoryName(categoria);
  const canonicalUrl = `${BASE_URL}/productos/${categoria}`;

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Inicio", item: BASE_URL },
      { "@type": "ListItem", position: 2, name: categoriaLabel, item: canonicalUrl },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <link rel="canonical" href={page === 1 ? canonicalUrl : `${canonicalUrl}?pagina=${page}`} />

      <div className="container-main py-12">
        <Breadcrumb
          items={[{ label: categoriaNombre }]}
          className="mb-8"
        />

        {/* Cabecera */}
        <div className="mb-10">
          <h1
            className="text-4xl font-light text-neutral-900 mb-3"
            style={{ fontFamily: "var(--font-cormorant)" }}
          >
            {formatCategoryName(categoriaNombre)}
          </h1>
          <div
            className="w-12 h-px mb-4"
            style={{ backgroundColor: "var(--color-oro)" }}
          />
          <p className="text-sm text-neutral-500">
            {count ?? 0} productos disponibles
          </p>
          {/* Texto SEO introductorio por categoría */}
          {SEO_INTRO[categoria] && (
            <p className="text-sm text-neutral-500 mt-3 max-w-2xl leading-relaxed">
              {SEO_INTRO[categoria]}
            </p>
          )}
        </div>

        {/* Filtro de subcategorías */}
        {subcategorias.length > 1 && (
          <div className="flex flex-wrap gap-2 mb-8">
            <Link
              href={`/productos/${categoria}`}
              className="px-4 py-2 text-xs tracking-widest uppercase border border-neutral-300 hover:border-neutral-800 transition-colors"
            >
              Todos
            </Link>
            {subcategorias.map((sub) => (
              <Link
                key={sub}
                href={`/productos/${categoria}/${slugifyCategoria(sub)}`}
                className="px-4 py-2 text-xs tracking-widest uppercase border border-neutral-300 hover:border-neutral-800 transition-colors"
              >
                {formatCategoryName(sub)}
              </Link>
            ))}
          </div>
        )}

        {/* Grid de productos */}
        {productos.length === 0 ? (
          <p className="text-sm text-neutral-400 py-16 text-center">
            No hay productos en esta categoría todavía.
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-4 gap-y-10">
            {productos.map((p, i) => (
              <ProductoCard key={p.id} producto={p} priority={i < 5} />
            ))}
          </div>
        )}

        {/* Paginación */}
        {totalPages > 1 && (
          <nav
            className="flex justify-center gap-2 mt-16"
            aria-label="Paginación"
          >
            {page > 1 && (
              <Link
                href={`/productos/${categoria}?pagina=${page - 1}`}
                className="px-4 py-2 text-sm border border-neutral-200 hover:border-neutral-800 transition-colors"
              >
                ← Anterior
              </Link>
            )}
            <span className="px-4 py-2 text-sm text-neutral-500">
              {page} / {totalPages}
            </span>
            {page < totalPages && (
              <Link
                href={`/productos/${categoria}?pagina=${page + 1}`}
                className="px-4 py-2 text-sm border border-neutral-200 hover:border-neutral-800 transition-colors"
              >
                Siguiente →
              </Link>
            )}
          </nav>
        )}

        {/* Bloque de texto SEO al final — visible para bots, no invasivo para usuario */}
        {SEO_FOOTER[categoria] && (
          <div className="mt-16 pt-8 border-t border-neutral-100">
            <div
              className="prose prose-sm prose-neutral max-w-none text-neutral-400"
              dangerouslySetInnerHTML={{ __html: SEO_FOOTER[categoria] }}
            />
          </div>
        )}

        {/* FAQs — rich results para Google */}
        {FAQ_DATA[categoria] && (
          <section className="mt-16 pt-8 border-t border-neutral-100">
            <h2
              className="text-2xl font-light text-neutral-900 mb-6"
              style={{ fontFamily: "var(--font-cormorant)" }}
            >
              Preguntas frecuentes
            </h2>
            <div className="space-y-4">
              {FAQ_DATA[categoria].map((faq, i) => (
                <details key={i} className="group border border-neutral-100 rounded-lg">
                  <summary className="flex items-center justify-between cursor-pointer p-4 text-sm font-medium text-neutral-800 hover:bg-neutral-50 transition-colors">
                    {faq.pregunta}
                    <span className="ml-2 text-neutral-400 group-open:rotate-180 transition-transform">▾</span>
                  </summary>
                  <div className="px-4 pb-4 text-sm text-neutral-600 leading-relaxed">
                    {faq.respuesta}
                  </div>
                </details>
              ))}
            </div>
            {/* JSON-LD FAQPage */}
            <script
              type="application/ld+json"
              dangerouslySetInnerHTML={{
                __html: JSON.stringify({
                  "@context": "https://schema.org",
                  "@type": "FAQPage",
                  mainEntity: FAQ_DATA[categoria].map((faq) => ({
                    "@type": "Question",
                    name: faq.pregunta,
                    acceptedAnswer: {
                      "@type": "Answer",
                      text: faq.respuesta,
                    },
                  })),
                }),
              }}
            />
          </section>
        )}

        {/* Enlaces internos a otras categorías */}
        {OTRAS_CATEGORIAS[categoria] && (
          <nav className="mt-16 pt-8 border-t border-neutral-100" aria-label="Categorías relacionadas">
            <h2
              className="text-2xl font-light text-neutral-900 mb-6"
              style={{ fontFamily: "var(--font-cormorant)" }}
            >
              También te puede interesar
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {OTRAS_CATEGORIAS[categoria].map((cat) => (
                <Link
                  key={cat.slug}
                  href={`/productos/${cat.slug}`}
                  className="group block p-4 border border-neutral-100 rounded-lg hover:border-neutral-300 transition-colors"
                >
                  <span className="text-sm font-medium text-neutral-800 group-hover:text-neutral-900">
                    {cat.label}
                  </span>
                  <span className="block text-xs text-neutral-400 mt-1">
                    {cat.descripcion}
                  </span>
                </Link>
              ))}
            </div>
          </nav>
        )}
      </div>
    </>
  );
}

// ── Textos SEO por categoría ──────────────────────────────────────────────────

const SEO_INTRO: Record<string, string> = {
  peluqueria:
    "Descubre nuestra selección de productos profesionales de peluquería: tintes, champús, mascarillas, tratamientos capilares, herramientas y mucho más. Marcas de referencia con envío rápido a toda España.",
  estetica:
    "Productos de estética profesional para tratamientos faciales, corporales, depilación, manicura y más. Todo lo que necesita tu centro de estética o tu rutina de cuidado en casa.",
  barberia:
    "Productos de barbería profesional para el cuidado del cabello y la barba masculina. Ceras, champús, tratamientos y accesorios de las mejores marcas.",
  perfumeria:
    "Fragancias y perfumes de marca para mujer y hombre. Descubre nuestra selección de eau de parfum, colonias y cosméticos de lujo a precios competitivos.",
};

const SEO_FOOTER: Record<string, string> = {
  peluqueria: `<h2>Productos profesionales de peluquería — Todo para tu salón</h2>
<p>En Esencia de Belleza encontrarás la gama completa de productos que necesita cualquier peluquería profesional: desde <strong>tintes y oxigenadas</strong> para la coloración más precisa, hasta <strong>champús, mascarillas y tratamientos capilares</strong> para el cuidado diario del cabello. También disponemos de una amplia selección de <strong>herramientas profesionales</strong> — secadores, planchas, máquinas de corte — y accesorios de peluquería.</p>
<p>Trabajamos con las marcas más reconocidas del sector: Schwarzkopf, Wella, L'Oréal Professionnel, Fanola, Salerm, Tahe, Yunsey y muchas más. Todos los productos están disponibles para particulares y profesionales, con <strong>precios especiales para cuentas profesionales verificadas</strong> y envío rápido a toda España.</p>`,

  estetica: `<h2>Productos de estética profesional para tu centro o clínica</h2>
<p>Nuestra sección de estética reúne todo lo necesario para el trabajo diario en un <strong>centro de estética o spa</strong>: cremas faciales e hidratantes de alta gama, sérums y contornos de ojos, mascarillas de tratamiento, productos de depilación profesional (ceras depiladoras y fundidores), material de <strong>manicura y pedicura</strong>, lámparas UV/LED y maquillaje profesional.</p>
<p>Contamos con marcas especializadas en estética profesional que garantizan resultados visibles en cabina. Si eres profesional del sector y quieres acceder a precios de tarifa B2B, regístrate como cuenta profesional y activa tu descuento.</p>`,

  barberia: `<h2>Barbería profesional — Productos para salón y uso personal</h2>
<p>La sección de barbería de Esencia de Belleza está pensada para barberos profesionales y para hombres que cuidan su imagen. Encontrarás <strong>ceras y pomadas de alta fijación</strong>, champús específicos para barba y cabello masculino, aceites y bálsamos de barba, así como productos de cuidado caballero de marcas como Hey Joe, Don Algodón, Kuul y Novon.</p>
<p>Todos los productos de nuestra sección de barbería están seleccionados por profesionales del sector para garantizar resultados de calidad en el salón y en casa. Envío rápido a toda España.</p>`,

  perfumeria: `<h2>Perfumería y fragancias — Eau de Parfum, colonias y ambientación</h2>
<p>Descubre nuestra selección de <strong>perfumes y fragancias</strong> para mujer y hombre. Contamos con eau de parfum, eau de toilette y colonias de marcas reconocidas, además de <strong>ambientadores, brumas y velas aromáticas</strong> para perfumar tu hogar o tu centro de estética.</p>
<p>Todos nuestros perfumes son originales y se envían en su embalaje original con factura. Si buscas una fragancia concreta que no encuentras en el catálogo, contacta con nosotros y te ayudaremos a encontrarla. Envío rápido a toda España.</p>`,
};

// ── FAQs por categoría (long-tail keywords + Google rich results) ─────────────

const FAQ_DATA: Record<string, { pregunta: string; respuesta: string }[]> = {
  peluqueria: [
    {
      pregunta: "¿Qué productos de peluquería profesional vendéis?",
      respuesta: "En Esencia de Belleza encontrarás tintes, decolorantes, oxigenadas, champús, mascarillas, acondicionadores, lacas, espumas, gominas, secadores, planchas, máquinas de corte, tijeras y todo tipo de accesorios para peluquería profesional.",
    },
    {
      pregunta: "¿Tenéis precios especiales para peluqueros profesionales?",
      respuesta: "Sí. Si eres profesional del sector, puedes registrarte como cuenta profesional y acceder a tarifas B2B con descuentos exclusivos. Solo necesitas verificar tu actividad profesional durante el registro.",
    },
    {
      pregunta: "¿Qué marcas de peluquería trabajáis?",
      respuesta: "Trabajamos con las principales marcas del sector: Schwarzkopf, Wella, L'Oréal Professionnel, Fanola, Salerm, Tahe, Yunsey, Revlon, KIS y muchas más. Todas originales y con garantía.",
    },
    {
      pregunta: "¿Hacéis envíos de productos de peluquería a toda España?",
      respuesta: "Sí, enviamos a toda España peninsular. El envío estándar tiene un coste de 5 €, pero es gratuito para pedidos superiores a 40 €. Entrega en 24-48 horas laborables.",
    },
  ],
  estetica: [
    {
      pregunta: "¿Qué productos de estética profesional tenéis?",
      respuesta: "Ofrecemos cremas faciales, sérums, mascarillas, productos corporales, ceras depiladoras, material de manicura y pedicura, lámparas UV/LED y maquillaje profesional de las mejores marcas del sector.",
    },
    {
      pregunta: "¿Los productos de estética son para profesionales o para particulares?",
      respuesta: "Ambos. Nuestros productos están pensados para centros de estética y spas, pero también están disponibles para particulares que quieren cuidarse en casa con productos de calidad profesional.",
    },
    {
      pregunta: "¿Tenéis productos de depilación profesional?",
      respuesta: "Sí, contamos con ceras depiladoras, fundidores de cera, depilatorios y todo el material necesario para depilación profesional en centro de estética.",
    },
  ],
  barberia: [
    {
      pregunta: "¿Qué productos de barbería vendéis?",
      respuesta: "Tenemos ceras y pomadas de barbería, champús específicos para barba, aceites y bálsamos, productos de afeitado y cuidado caballero de marcas como Hey Joe, Don Algodón, Kuul y Novon.",
    },
    {
      pregunta: "¿Los productos de barbería son para salones o para uso personal?",
      respuesta: "Ambos. Están seleccionados por profesionales del sector para garantizar resultados de calidad tanto en el salón como en casa.",
    },
  ],
  perfumeria: [
    {
      pregunta: "¿Los perfumes que vendéis son originales?",
      respuesta: "Sí, todos nuestros perfumes son 100% originales. Se envían en su embalaje original con factura. Trabajamos directamente con distribuidores oficiales.",
    },
    {
      pregunta: "¿Qué tipos de fragancias tenéis?",
      respuesta: "Ofrecemos eau de parfum, eau de toilette y colonias para mujer y hombre, además de ambientadores, brumas y velas aromáticas para el hogar.",
    },
    {
      pregunta: "¿Puedo pedir un perfume que no está en el catálogo?",
      respuesta: "Sí, si buscas una fragancia concreta que no encuentras en nuestra tienda online, contacta con nosotros y te ayudaremos a encontrarla al mejor precio.",
    },
  ],
};

// ── Enlaces internos a otras categorías ───────────────────────────────────────

const OTRAS_CATEGORIAS: Record<string, { slug: string; label: string; descripcion: string }[]> = {
  peluqueria: [
    { slug: "estetica", label: "Estética", descripcion: "Cuidado facial, corporal y depilación" },
    { slug: "barberia", label: "Barbería", descripcion: "Productos para barba y cabello masculino" },
    { slug: "perfumeria", label: "Perfumería", descripcion: "Fragancias y ambientación" },
  ],
  estetica: [
    { slug: "peluqueria", label: "Peluquería", descripcion: "Tintes, champús y tratamientos capilares" },
    { slug: "barberia", label: "Barbería", descripcion: "Cuidado masculino y barbería profesional" },
    { slug: "perfumeria", label: "Perfumería", descripcion: "Fragancias de marca y ambientación" },
  ],
  barberia: [
    { slug: "peluqueria", label: "Peluquería", descripcion: "Productos capilares profesionales" },
    { slug: "estetica", label: "Estética", descripcion: "Cuidado facial y corporal" },
    { slug: "perfumeria", label: "Perfumería", descripcion: "Colonias y fragancias masculinas" },
  ],
  perfumeria: [
    { slug: "peluqueria", label: "Peluquería", descripcion: "Tintes, champús y herramientas" },
    { slug: "estetica", label: "Estética", descripcion: "Cremas, sérums y cuidado facial" },
    { slug: "barberia", label: "Barbería", descripcion: "Ceras, champús y cuidado caballero" },
  ],
};
