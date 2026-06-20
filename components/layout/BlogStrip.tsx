"use client";

import { useRef } from "react";
import Link from "next/link";

interface PostPreview {
  slug: string;
  titulo: string;
  resumen: string | null;
  imagen_url: string | null;
  published_at: string | null;
}

export function BlogStrip({ posts }: { posts: PostPreview[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  if (!posts.length) return null;

  const scroll = (dir: "left" | "right") => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({ left: dir === "right" ? 300 : -300, behavior: "smooth" });
  };

  return (
    <section className="py-16 bg-neutral-50 overflow-hidden">
      <div className="container-main mb-8">
        <div className="flex items-baseline justify-between">
          <div>
            <p className="text-xs tracking-[0.3em] uppercase mb-1" style={{ color: "var(--color-oro)" }}>
              Consejos y tendencias
            </p>
            <h2 className="text-2xl font-light text-neutral-900" style={{ fontFamily: "var(--font-cormorant)" }}>
              Del blog
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => scroll("left")}
              aria-label="Anterior"
              className="w-9 h-9 flex items-center justify-center border border-neutral-200 text-neutral-500 hover:border-neutral-400 hover:text-neutral-900 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>
            <button
              onClick={() => scroll("right")}
              aria-label="Siguiente"
              className="w-9 h-9 flex items-center justify-center border border-neutral-200 text-neutral-500 hover:border-neutral-400 hover:text-neutral-900 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
            <Link href="/blog" className="text-xs tracking-widest uppercase text-neutral-400 hover:text-neutral-700 transition-colors hidden sm:block">
              Ver todos →
            </Link>
          </div>
        </div>
      </div>

      {/* Cards horizontales con scroll */}
      <div className="relative">
        <div
          ref={scrollRef}
          className="flex gap-5 overflow-x-auto scroll-smooth pb-2 px-6"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {posts.map((post) => (
            <article
              key={post.slug}
              className="group flex-shrink-0 w-72 bg-white border border-neutral-100 flex flex-col hover:border-neutral-300 hover:shadow-sm transition-all"
            >
              <Link href={`/blog/${post.slug}`} className="block overflow-hidden aspect-[16/9] bg-neutral-100">
                {post.imagen_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={post.imagen_url}
                    alt={post.titulo}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="w-8 h-px bg-neutral-200" />
                  </div>
                )}
              </Link>

              <div className="p-4 flex flex-col flex-1">
                {post.published_at && (
                  <p className="text-[10px] tracking-widest uppercase text-neutral-400 mb-2">
                    {new Date(post.published_at).toLocaleDateString("es-ES", {
                      day: "numeric", month: "short", year: "numeric",
                    })}
                  </p>
                )}
                <h3
                  className="text-base font-light text-neutral-900 leading-snug mb-2 group-hover:text-[#C4857A] transition-colors line-clamp-2"
                  style={{ fontFamily: "var(--font-cormorant)" }}
                >
                  <Link href={`/blog/${post.slug}`}>{post.titulo}</Link>
                </h3>
                {post.resumen && (
                  <p className="text-xs text-neutral-500 leading-relaxed line-clamp-2 flex-1">
                    {post.resumen}
                  </p>
                )}
                <Link
                  href={`/blog/${post.slug}`}
                  className="mt-3 text-[10px] tracking-widest uppercase text-neutral-700 hover:text-[#C4857A] transition-colors"
                >
                  Leer →
                </Link>
              </div>
            </article>
          ))}
        </div>
        <div className="pointer-events-none absolute top-0 left-0 h-full w-10 bg-gradient-to-r from-neutral-50 to-transparent" />
        <div className="pointer-events-none absolute top-0 right-0 h-full w-16 bg-gradient-to-l from-neutral-50 to-transparent" />
      </div>
      <div className="container-main mt-4 sm:hidden">
        <Link href="/blog" className="text-xs tracking-widest uppercase text-neutral-400 hover:text-neutral-700 transition-colors">
          Ver todos →
        </Link>
      </div>
    </section>
  );
}
