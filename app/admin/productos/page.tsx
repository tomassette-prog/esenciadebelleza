import type { Metadata } from "next";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { slugifyCategoria } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Productos | Admin",
  robots: { index: false, follow: false },
};

interface SearchParams {
  q?: string;
  cat?: string;
  estado?: string;
}

export default async function AdminProductosPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { q, cat, estado } = await searchParams;
  const supabase = createAdminClient();

  let query = supabase
    .from("productos_padre")
    .select(`
      id, nombre, slug, categoria, subcategoria, activo, destacado, nuevo, imagen_principal_url,
      marca:marcas(nombre),
      variaciones:productos_variaciones(id, activa, stock)
    `)
    .order("nombre");

  if (q) query = query.ilike("nombre", `%${q}%`);
  if (cat) query = query.ilike("categoria", cat.replace(/-/g, " "));
  if (estado === "activo") query = query.eq("activo", true);
  else if (estado === "inactivo") query = query.eq("activo", false);

  const { data: productos } = await query;

  // Categorías para el filtro
  const { data: catData } = await supabase
    .from("productos_padre")
    .select("categoria")
    .eq("activo", true);
  const categorias = [...new Set((catData ?? []).map((p) => p.categoria))].sort();

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-light text-neutral-900" style={{ fontFamily: "var(--font-cormorant)" }}>
            Productos
          </h1>
          <p className="text-sm text-neutral-400 mt-1">
            {productos?.length ?? 0} productos encontrados
          </p>
        </div>
        <Link
          href="/admin/productos/nuevo"
          className="btn-primary px-6 py-2.5 text-sm tracking-widest uppercase"
        >
          + Nuevo producto
        </Link>
      </div>

      {/* Filtros */}
      <form method="get" className="flex flex-wrap gap-3 bg-white border border-neutral-200 p-4">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Buscar por nombre..."
          className="input-clean flex-1 min-w-48 text-sm"
        />
        <select name="cat" defaultValue={cat} className="input-clean text-sm min-w-40">
          <option value="">Todas las categorías</option>
          {categorias.map((c) => (
            <option key={c} value={slugifyCategoria(c)}>
              {c}
            </option>
          ))}
        </select>
        <select name="estado" defaultValue={estado} className="input-clean text-sm min-w-32">
          <option value="">Todos</option>
          <option value="activo">Activos</option>
          <option value="inactivo">Inactivos</option>
        </select>
        <button type="submit" className="btn-primary px-5 py-2 text-sm">
          Filtrar
        </button>
        <Link href="/admin/productos" className="px-5 py-2 text-sm border border-neutral-300 hover:border-neutral-600 transition-colors">
          Limpiar
        </Link>
      </form>

      {/* Tabla */}
      <div className="bg-white border border-neutral-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50">
                <th className="text-left px-4 py-3 font-medium text-neutral-600 text-xs uppercase tracking-widest">Producto</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-600 text-xs uppercase tracking-widest hidden md:table-cell">Categoría</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-600 text-xs uppercase tracking-widest hidden lg:table-cell">URL</th>
                <th className="text-center px-4 py-3 font-medium text-neutral-600 text-xs uppercase tracking-widest">Vars</th>
                <th className="text-center px-4 py-3 font-medium text-neutral-600 text-xs uppercase tracking-widest">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {(productos ?? []).map((p) => {
                const varsActivas = (p.variaciones ?? []).filter((v: { activa: boolean }) => v.activa);
                const stockTotal = varsActivas.reduce((acc: number, v: { stock: number }) => acc + v.stock, 0);
                const urlPath = `/productos/${slugifyCategoria(p.categoria)}/${slugifyCategoria(p.subcategoria ?? "general")}/${p.slug}`;

                return (
                  <tr key={p.id} className="hover:bg-neutral-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {p.imagen_principal_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.imagen_principal_url} alt="" className="w-10 h-10 object-contain bg-neutral-50 border border-neutral-100 shrink-0" />
                        ) : (
                          <div className="w-10 h-10 bg-neutral-100 border border-neutral-200 shrink-0" />
                        )}
                        <div>
                          <p className="font-medium text-neutral-900 line-clamp-1">{p.nombre}</p>
                          <p className="text-xs text-neutral-400">{(p.marca as unknown as { nombre: string } | null)?.nombre ?? "Sin marca"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-neutral-600 hidden md:table-cell">
                      <span>{p.categoria}</span>
                      {p.subcategoria && (
                        <span className="text-neutral-400"> / {p.subcategoria}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="text-xs text-neutral-400 font-mono break-all">{urlPath}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="text-sm font-medium">{varsActivas.length}</div>
                      <div className="text-xs text-neutral-400">stock: {stockTotal}</div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 text-xs ${
                          p.activo
                            ? "bg-green-50 text-green-700 border border-green-200"
                            : "bg-neutral-100 text-neutral-500 border border-neutral-200"
                        }`}
                      >
                        {p.activo ? "Activo" : "Inactivo"}
                      </span>
                      {p.destacado && (
                        <span className="ml-1 inline-block px-2 py-0.5 text-xs bg-amber-50 text-amber-700 border border-amber-200">★</span>
                      )}
                      {p.nuevo && (
                        <span className="ml-1 inline-block px-2 py-0.5 text-xs bg-blue-50 text-blue-700 border border-blue-200">Nuevo</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={urlPath}
                          target="_blank"
                          className="text-xs text-neutral-400 hover:text-neutral-700 transition-colors"
                          title="Ver en tienda"
                        >
                          ↗
                        </Link>
                        <Link
                          href={`/admin/productos/${p.id}`}
                          className="text-xs text-neutral-600 hover:text-neutral-900 underline underline-offset-2 transition-colors"
                        >
                          Editar
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {(productos ?? []).length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center text-sm text-neutral-400">
                    No se encontraron productos con los filtros actuales.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
