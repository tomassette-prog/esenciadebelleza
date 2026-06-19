import type { Metadata } from "next";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { Breadcrumb } from "@/components/layout/Breadcrumb";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Blog de Belleza y Peluquería | Esencia de Belleza",
  description: "Consejos, tendencias y tutoriales de peluquería y estética profesional. Aprende los mejores tratamientos capilares y técnicas de belleza.",
  alternates: { canonical: "https://esenciadebelleza.es/blog" },
};

export default async function BlogPage() {
  const supabase = createAdminClient();

  const { data: posts } = await supabase
    .from("posts")
    .select("id, slug, titulo, resumen, imagen_url, published_at, autor")
    .eq("publicado", true)
    .order("published_at", { ascending: false });

  return (
    <main className="container-main py-12 lg:py-16">
      <Breadcrumb items={[{ label: "Blog" }]} className="mb-8" />

      <div className="mb-10">
        <h1
          className="text-4xl lg:text-5xl font-light text-neutral-900"
          style={{ fontFamily: "var(--font-cormorant)" }}
        >
          Blog de Belleza
        </h1>
        <p className="text-neutral-500 mt-3 max-w-xl">
          Consejos profesionales, tendencias y guías de tratamientos para el cuidado del cabello y la piel.
        </p>
      </div>

      {!posts || posts.length === 0 ? (
        <p className="text-neutral-400 text-sm py-16 text-center">
          Próximamente publicaremos nuestros primeros artículos.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {posts.map((post) => (
            <article key={post.id} className="group flex flex-col">
              {post.imagen_url && (
                <Link href={`/blog/${post.slug}`} className="block overflow-hidden aspect-[16/9] bg-neutral-100 mb-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={post.imagen_url}
                    alt={post.titulo}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                </Link>
              )}

              <div className="flex flex-col flex-1">
                <p className="text-xs tracking-widest uppercase text-neutral-400 mb-2">
                  {post.published_at
                    ? new Date(post.published_at).toLocaleDateString("es-ES", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })
                    : ""}
                </p>

                <h2
                  className="text-xl font-light text-neutral-900 leading-snug mb-3 group-hover:text-[#C9A84C] transition-colors"
                  style={{ fontFamily: "var(--font-cormorant)" }}
                >
                  <Link href={`/blog/${post.slug}`}>{post.titulo}</Link>
                </h2>

                {post.resumen && (
                  <p className="text-sm text-neutral-500 leading-relaxed flex-1 line-clamp-3">
                    {post.resumen}
                  </p>
                )}

                <Link
                  href={`/blog/${post.slug}`}
                  className="mt-4 text-xs tracking-widest uppercase text-neutral-900 hover:text-[#C9A84C] transition-colors inline-flex items-center gap-2"
                >
                  Leer artículo →
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
