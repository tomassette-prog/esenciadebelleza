import type { Metadata } from "next";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import EliminarPostBtn from "@/components/admin/EliminarPostBtn";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Blog | Admin",
  robots: { index: false, follow: false },
};

export default async function AdminBlogPage() {
  const supabase = createAdminClient();

  const { data: posts } = await supabase
    .from("posts")
    .select("id, slug, titulo, publicado, destacado, published_at, created_at")
    .order("created_at", { ascending: false });

  const publicados = (posts ?? []).filter((p) => p.publicado).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1
            className="text-2xl font-light text-neutral-900"
            style={{ fontFamily: "var(--font-cormorant)" }}
          >
            Blog
          </h1>
          <p className="text-sm text-neutral-500 mt-1">
            {posts?.length ?? 0} posts · {publicados} publicados
          </p>
        </div>
        <Link
          href="/admin/blog/nuevo"
          className="px-5 py-2.5 bg-neutral-900 text-white text-xs tracking-widest uppercase hover:bg-neutral-700 transition-colors"
        >
          + Nuevo post
        </Link>
      </div>

      {!posts || posts.length === 0 ? (
        <div className="py-16 text-center text-neutral-400 text-sm border border-dashed border-neutral-200">
          No hay posts todavía.{" "}
          <Link href="/admin/blog/nuevo" className="underline text-neutral-600">
            Crear el primero
          </Link>
        </div>
      ) : (
        <div className="bg-white border border-neutral-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-100 bg-neutral-50">
                <th className="text-left text-xs tracking-wider uppercase text-neutral-500 px-4 py-3 font-normal">Título</th>
                <th className="text-left text-xs tracking-wider uppercase text-neutral-500 px-4 py-3 font-normal">Estado</th>
                <th className="text-left text-xs tracking-wider uppercase text-neutral-500 px-4 py-3 font-normal">Fecha</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-50">
              {posts.map((post) => (
                <tr key={post.id} className="hover:bg-neutral-50 transition-colors">
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-neutral-900 font-medium">{post.titulo}</p>
                      <p className="text-xs text-neutral-400 mt-0.5">/blog/{post.slug}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 ${
                          post.publicado
                            ? "bg-green-50 text-green-700 border border-green-200"
                            : "bg-amber-50 text-amber-700 border border-amber-200"
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${post.publicado ? "bg-green-500" : "bg-amber-500"}`} />
                        {post.publicado ? "Publicado" : "Borrador"}
                      </span>
                      {post.destacado && (
                        <span className="text-xs px-2 py-0.5 bg-[#C9A84C]/10 text-[#8B6914] border border-[#C9A84C]/30">
                          Destacado
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-neutral-500 text-xs whitespace-nowrap">
                    {post.published_at
                      ? new Date(post.published_at).toLocaleDateString("es-ES")
                      : new Date(post.created_at).toLocaleDateString("es-ES")}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <Link
                        href={`/blog/${post.slug}`}
                        target="_blank"
                        className="text-xs px-3 py-1.5 border border-neutral-200 text-neutral-600 hover:border-neutral-900 hover:text-neutral-900 transition-colors tracking-wider uppercase"
                      >
                        Ver
                      </Link>
                      <Link
                        href={`/admin/blog/${post.id}`}
                        className="text-xs px-3 py-1.5 bg-neutral-900 text-white hover:bg-neutral-700 transition-colors tracking-wider uppercase"
                      >
                        Editar
                      </Link>
                      <EliminarPostBtn id={post.id} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
