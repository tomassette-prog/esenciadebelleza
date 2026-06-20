import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ProductoCard } from "@/components/producto/ProductoCard";
import { CarruselProductos } from "@/components/producto/CarruselProductos";
import { BlogStrip } from "@/components/layout/BlogStrip";
import { slugifyCategoria, formatCategoryName } from "@/lib/seo";
import type { ProductoCatalogo } from "@/types/producto";
import MarcasCarrusel from "@/components/layout/MarcasCarrusel";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Esencia de Belleza | Productos Profesionales de Peluquería y Estética",
  description:
    "Tienda online de productos profesionales de peluquería, estética y perfumería. Precios para particulares y tarifas especiales para profesionales. Envío rápido en España.",
  robots: { index: true, follow: true },
};

export default async function HomePage() {
  const supabase = await createClient();

  // Posts destacados para la sección del blog en home
  const adminClient = createAdminClient();
  const { data: postsDestacados } = await adminClient
    .from("posts")
    .select("slug, titulo, resumen, imagen_url, published_at")
    .eq("publicado", true)
    .eq("destacado", true)
    .order("published_at", { ascending: false })
    .limit(3);

  // Si no hay destacados, tomar los 3 más recientes
  const { data: postsRecientes } = !postsDestacados?.length
    ? await adminClient
        .from("posts")
        .select("slug, titulo, resumen, imagen_url, published_at")
        .eq("publicado", true)
        .order("published_at", { ascending: false })
        .limit(3)
    : { data: null };

  const posts = postsDestacados?.length ? postsDestacados : (postsRecientes ?? []);

  // Ofertas destacadas para el carrusel entre marcas
  const { data: ofertasRaw } = await supabase
    .from("productos_padre")
    .select(
      `id, nombre, slug, categoria, subcategoria,
       imagen_principal_url, destacado, nuevo,
       marca:marcas(nombre),
       variaciones:productos_variaciones!inner(precio_b2c, activa, stock)`
    )
    .eq("activo", true)
    .eq("oferta", true)
    .eq("variaciones.activa", true)
    .limit(12);

  // Novedades / destacados para la home (solo con stock)
  const { data: destacadosRaw } = await supabase
    .from("productos_padre")
    .select(
      `id, nombre, slug, categoria, subcategoria,
       imagen_principal_url, destacado, nuevo,
       marca:marcas(nombre),
       variaciones:productos_variaciones!inner(precio_b2c, activa, stock)`
    )
    .eq("activo", true)
    .eq("destacado", true)
    .eq("variaciones.activa", true)
    .limit(8);

  const { data: nuevosRaw } = await supabase
    .from("productos_padre")
    .select(
      `id, nombre, slug, categoria, subcategoria,
       imagen_principal_url, destacado, nuevo,
       marca:marcas(nombre),
       variaciones:productos_variaciones!inner(precio_b2c, activa, stock)`
    )
    .eq("activo", true)
    .eq("nuevo", true)
    .eq("variaciones.activa", true)
    .limit(8);

  // Marcas con logo para el carrusel
  const { data: marcasRaw } = await supabase
    .from("marcas")
    .select("id, nombre, slug, logo_url")
    .eq("activa", true)
    .not("logo_url", "is", null)
    .order("nombre");
  const marcasConLogo = marcasRaw ?? [];

  // Conteo real de categorías usando función SQL (COUNT DISTINCT, sin límite de filas)
  const { data: todosRaw } = await supabase.rpc("get_category_counts");

  const categorias = (todosRaw ?? []).map((row: { categoria: string; total: number }) => ({
    slug: slugifyCategoria(row.categoria),
    nombre: row.categoria,
    total: Number(row.total),
  }));

  function toProductoCatalogo(p: ReturnType<typeof Object.assign>): ProductoCatalogo {
    const vars = (p.variaciones ?? []).filter((v: { activa: boolean }) => v.activa);
    return {
      id: p.id,
      nombre: p.nombre,
      slug: p.slug,
      categoria: p.categoria,
      subcategoria: p.subcategoria,
      imagen_principal_url: p.imagen_principal_url,
      destacado: p.destacado,
      nuevo: p.nuevo,
      marca_nombre: (p.marca as { nombre: string } | null)?.nombre ?? null,
      precio_desde: vars.length > 0 ? Math.min(...vars.map((v: { precio_b2c: number }) => v.precio_b2c)) : 0,
      total_variaciones: vars.length,
    };
  }

  const destacados: ProductoCatalogo[] = (destacadosRaw ?? []).map(toProductoCatalogo);
  const nuevos: ProductoCatalogo[] = (nuevosRaw ?? []).map(toProductoCatalogo);
  const ofertas: ProductoCatalogo[] = (ofertasRaw ?? []).map(toProductoCatalogo);
  // Si no hay ofertas, mostrar destacados en el carrusel
  const carruselProductos = ofertas.length > 0 ? ofertas : destacados;
  const carruselTitulo = ofertas.length > 0 ? "Ofertas destacadas" : "Productos destacados";
  const carruselSubtitulo = ofertas.length > 0 ? "No te lo pierdas" : "Lo más popular";
  const tieneProductos = categorias.length > 0;

  return (
    <main className="min-h-screen bg-white flex flex-col">

      {/* ── Hero ── */}
      <section
        className="relative flex flex-col items-center justify-center text-center px-6"
        style={{ minHeight: "100svh" }}
      >
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=1800&q=80&auto=format&fit=crop')",
          }}
          aria-hidden="true"
        />
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(to bottom, rgba(10,10,10,0.55) 0%, rgba(10,10,10,0.70) 60%, rgba(10,10,10,0.85) 100%)" }}
          aria-hidden="true"
        />

        <div className="relative z-10 flex flex-col items-center">
          {!tieneProductos && (
            <span
              className="text-xs tracking-[0.4em] uppercase mb-4 block"
              style={{ fontFamily: "var(--font-inter)", color: "var(--color-oro-light)" }}
            >
              Próximamente
            </span>
          )}

          <h1
            className="text-5xl sm:text-6xl lg:text-8xl font-light text-white mb-4"
            style={{ fontFamily: "var(--font-cormorant)", letterSpacing: "-0.02em", textShadow: "0 2px 24px rgba(0,0,0,0.4)" }}
          >
            Esencia de Belleza
          </h1>

          <div className="w-16 h-px mb-4" style={{ backgroundColor: "var(--color-oro)" }} />

          <p
            className="text-xs tracking-[0.25em] uppercase mb-10"
            style={{ fontFamily: "var(--font-inter)", color: "var(--color-oro-light)" }}
          >
            Peluquería · Estética · Perfumería
          </p>

          {tieneProductos ? (
            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/productos" className="btn-primary px-10 py-4 text-sm tracking-widest uppercase">
                Ver catálogo
              </Link>
              <Link href="/profesionales" className="px-10 py-4 text-sm tracking-widest uppercase border border-white/40 text-white hover:border-white transition-colors">
                Soy profesional
              </Link>
            </div>
          ) : (
            <>
              <p className="max-w-lg text-sm text-neutral-300 leading-relaxed mb-10">
                Productos profesionales de peluquería, estética y perfumería.
                Precios para particulares y tarifas exclusivas para profesionales del sector.
              </p>
              <SubscriptionForm />
            </>
          )}
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 animate-bounce">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </section>

      {/* ── Carrusel de marcas (marquee) ── */}
      {marcasConLogo.length > 0 && (
        <MarcasCarrusel marcas={marcasConLogo as { id: string; nombre: string; slug: string; logo_url: string }[]} />
      )}

      {/* ── Carrusel de ofertas / productos destacados ── */}
      {tieneProductos && carruselProductos.length > 0 && (
        <CarruselProductos
          productos={carruselProductos}
          titulo={carruselTitulo}
          subtitulo={carruselSubtitulo}
          verTodosHref="/productos"
        />
      )}

      {/* ── Nuestras marcas ── */}
      {tieneProductos && marcasConLogo.length > 0 && (
        <section className="py-20 px-6 bg-neutral-50">
          <div className="container-main">
            <div className="flex items-baseline justify-between mb-10">
              <div>
                <p className="text-xs tracking-[0.3em] uppercase text-neutral-400 mb-2"
                  style={{ fontFamily: "var(--font-inter)" }}>
                  Trabaja con las mejores
                </p>
                <h2 className="text-3xl font-light text-neutral-900"
                  style={{ fontFamily: "var(--font-cormorant)" }}>
                  Nuestras marcas
                </h2>
              </div>
              <Link href="/marcas"
                className="text-xs tracking-widest uppercase text-neutral-400 hover:text-neutral-700 transition-colors hidden sm:block">
                Ver todas →
              </Link>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-4">
              {marcasConLogo.slice(0, 12).map((marca) => (
                <Link
                  key={marca.id}
                  href={`/marcas/${marca.slug}`}
                  className="group bg-white border border-neutral-100 p-5 flex flex-col items-center gap-3 hover:border-neutral-300 hover:shadow-sm transition-all"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={marca.logo_url!}
                    alt={marca.nombre}
                    className="h-10 w-full object-contain grayscale group-hover:grayscale-0 transition-all duration-300"
                    loading="lazy"
                  />
                  <span className="text-[10px] tracking-widest uppercase text-neutral-400 group-hover:text-neutral-700 transition-colors text-center leading-tight">
                    {marca.nombre}
                  </span>
                </Link>
              ))}
            </div>
            <div className="text-center mt-8 sm:hidden">
              <Link href="/marcas"
                className="text-xs tracking-widest uppercase text-neutral-400 hover:text-neutral-700 transition-colors">
                Ver todas las marcas →
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ── Novedades ── */}
      {nuevos.length > 0 && (
        <CarruselProductos
          productos={nuevos}
          titulo="Novedades"
          subtitulo="Recién llegados"
          verTodosHref="/productos"
        />
      )}

      {/* ── Blog strip horizontal ── */}
      <BlogStrip posts={posts} />

      {/* ── Banner profesionales ── */}
      <section className="py-16 px-6 bg-neutral-900">
        <div className="container-main flex flex-col sm:flex-row items-center justify-between gap-8">
          <div>
            <p className="text-xs tracking-[0.3em] uppercase mb-2" style={{ color: "var(--color-oro)" }}>
              Para profesionales
            </p>
            <h2 className="text-3xl font-light text-white" style={{ fontFamily: "var(--font-cormorant)" }}>
              Precios exclusivos para salones y clínicas
            </h2>
            <p className="text-sm text-neutral-400 mt-2 max-w-md">
              Regístrate como profesional y accede a tarifas especiales en toda la gama de productos.
            </p>
          </div>
          <Link
            href="/profesionales"
            className="whitespace-nowrap px-8 py-4 text-xs tracking-widest uppercase border text-white hover:bg-white hover:text-neutral-900 transition-colors"
            style={{ borderColor: "var(--color-oro)" }}
          >
            Saber más
          </Link>
        </div>
      </section>

      {/* ── Categorías estáticas fallback (sin productos) ── */}
      {!tieneProductos && (
        <section className="py-20 px-6 bg-white">
          <div className="max-w-4xl mx-auto">
            <p className="text-center text-xs tracking-[0.3em] uppercase text-neutral-400 mb-12" style={{ fontFamily: "var(--font-inter)" }}>
              Nuestras categorías
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-neutral-100">
              {CATEGORIAS_ESTATICAS.map((cat) => (
                <div key={cat} className="bg-white flex flex-col items-center justify-center gap-4 py-12 px-6">
                  <div className="w-10 h-px" style={{ backgroundColor: "var(--color-oro)" }} />
                  <span className="text-xs tracking-[0.2em] uppercase text-neutral-600 text-center" style={{ fontFamily: "var(--font-inter)" }}>
                    {cat}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

    </main>
  );
}

const CATEGORIAS_ESTATICAS = ["Tintes & Color", "Champús & Máscaras", "Perfumería", "Estética"];

function SubscriptionForm() {
  return (
    <form
      action={async (formData: FormData) => {
        "use server";
        const email = formData.get("email");
        console.log("Nuevo suscriptor:", email);
      }}
      className="w-full max-w-md"
    >
      <p className="text-xs tracking-widest uppercase text-neutral-400 mb-4">
        Avísame cuando abramos
      </p>
      <div className="flex gap-0">
        <input
          type="email"
          name="email"
          required
          placeholder="tu@email.com"
          className="input-clean flex-1 border-r-0"
          aria-label="Tu dirección de email"
        />
        <button type="submit" className="btn-primary whitespace-nowrap px-8">
          Apuntarme
        </button>
      </div>
      <p className="text-xs text-neutral-400 mt-3">Sin spam. Sólo avisamos del lanzamiento.</p>
    </form>
  );
}
