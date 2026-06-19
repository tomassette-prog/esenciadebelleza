import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { Breadcrumb } from "@/components/layout/Breadcrumb";

export const revalidate = 3600;

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("posts")
    .select("slug")
    .eq("publicado", true);
  return (data ?? []).map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const supabase = createAdminClient();
  const { data: post } = await supabase
    .from("posts")
    .select("titulo, seo_title, seo_description, imagen_url, slug")
    .eq("slug", slug)
    .eq("publicado", true)
    .single();

  if (!post) return { title: "Artículo no encontrado" };

  const title       = post.seo_title ?? `${post.titulo} | Esencia de Belleza`;
  const description = post.seo_description ?? "";
  const url         = `https://esenciadebelleza.es/blog/${post.slug}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    keywords: post.keywords ?? undefined,
    openGraph: {
      title,
      description,
      url,
      type: "article",
      siteName: "Esencia de Belleza",
      images: post.imagen_url ? [{ url: post.imagen_url, alt: post.imagen_alt ?? title }] : [],
    },
  };
}

export default async function PostPage({ params }: PageProps) {
  const { slug } = await params;
  const supabase = createAdminClient();

  const { data: post } = await supabase
    .from("posts")
    .select("id, slug, titulo, resumen, contenido_html, seo_title, seo_description, imagen_url, imagen_alt, keywords, published_at, updated_at, autor, publicado")
    .eq("slug", slug)
    .eq("publicado", true)
    .single();

  if (!post) notFound();

  // Posts relacionados (últimos 3 excluyendo el actual)
  const { data: relacionados } = await supabase
    .from("posts")
    .select("slug, titulo, resumen, imagen_url, published_at")
    .eq("publicado", true)
    .neq("slug", slug)
    .order("published_at", { ascending: false })
    .limit(3);

  // JSON-LD Article schema
  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.titulo,
    description: post.seo_description ?? post.resumen ?? "",
    image: post.imagen_url ?? undefined,
    datePublished: post.published_at ?? post.created_at,
    dateModified: post.updated_at,
    author: { "@type": "Organization", name: post.autor ?? "Esencia de Belleza" },
    publisher: {
      "@type": "Organization",
      name: "Esencia de Belleza",
      url: "https://esenciadebelleza.es",
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": `https://esenciadebelleza.es/blog/${post.slug}` },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />

      <main className="container-main py-12 lg:py-16">
        <Breadcrumb
          items={[{ label: "Blog", href: "/blog" }, { label: post.titulo }]}
          className="mb-8"
        />

        <div className="max-w-3xl mx-auto">
          {/* Cabecera */}
          <header className="mb-10">
            <p className="text-xs tracking-widest uppercase text-neutral-400 mb-4">
              {post.published_at
                ? new Date(post.published_at).toLocaleDateString("es-ES", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })
                : ""}
              {post.autor && ` · ${post.autor}`}
            </p>

            <h1
              className="text-3xl lg:text-5xl font-light text-neutral-900 leading-tight mb-6"
              style={{ fontFamily: "var(--font-cormorant)" }}
            >
              {post.titulo}
            </h1>

            {post.resumen && (
              <p className="text-lg text-neutral-500 leading-relaxed border-l-2 border-[#C9A84C] pl-4">
                {post.resumen}
              </p>
            )}
          </header>

          {/* Imagen destacada */}
          {post.imagen_url && (
            <div className="mb-10 aspect-[16/9] overflow-hidden bg-neutral-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={post.imagen_url}
                alt={post.imagen_alt ?? post.titulo}
                className="w-full h-full object-cover"
                loading="eager"
              />
            </div>
          )}

          {/* Contenido */}
          <div
            className="prose prose-neutral max-w-none
              prose-headings:font-light prose-headings:text-neutral-900
              prose-h2:text-2xl prose-h2:mt-10 prose-h2:mb-4
              prose-h3:text-xl prose-h3:mt-8 prose-h3:mb-3
              prose-p:text-neutral-600 prose-p:leading-relaxed
              prose-a:text-[#C9A84C] prose-a:no-underline hover:prose-a:underline
              prose-strong:text-neutral-800
              prose-table:text-sm prose-th:text-neutral-700 prose-th:font-medium
              prose-td:text-neutral-600"
            dangerouslySetInnerHTML={{ __html: post.contenido_html }}
          />

          {/* Volver al blog */}
          <div className="mt-16 pt-8 border-t border-neutral-100">
            <Link
              href="/blog"
              className="text-xs tracking-widest uppercase text-neutral-500 hover:text-neutral-900 transition-colors"
            >
              ← Volver al blog
            </Link>
          </div>
        </div>

        {/* Posts relacionados */}
        {relacionados && relacionados.length > 0 && (
          <section className="mt-20 pt-12 border-t border-neutral-100">
            <h2
              className="text-2xl font-light text-neutral-900 mb-8"
              style={{ fontFamily: "var(--font-cormorant)" }}
            >
              Artículos relacionados
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {relacionados.map((r) => (
                <article key={r.slug} className="group">
                  {r.imagen_url && (
                    <Link href={`/blog/${r.slug}`} className="block overflow-hidden aspect-[16/9] bg-neutral-100 mb-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={r.imagen_url}
                        alt={r.titulo}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                      />
                    </Link>
                  )}
                  <h3
                    className="text-lg font-light text-neutral-900 group-hover:text-[#C9A84C] transition-colors leading-snug"
                    style={{ fontFamily: "var(--font-cormorant)" }}
                  >
                    <Link href={`/blog/${r.slug}`}>{r.titulo}</Link>
                  </h3>
                </article>
              ))}
            </div>
          </section>
        )}
      </main>
    </>
  );
}
