import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { slugifyCategoria } from "@/lib/seo";
import { FiltrosProductos } from "./FiltrosProductos";
import { GenerarSeoBtn } from "./GenerarSeoBtn";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Productos | Admin",
  robots: { index: false, follow: false },
};

interface SearchParams {
  q?: string;
  cat?: string;
  subcat?: string;
  marca?: string;
  estado?: string;
  flag?: string;
  page?: string;
}

const PAGE_SIZE = 100;

export default async function AdminProductosPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { q, cat, subcat, marca, estado, flag, page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10));
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  const supabase = createAdminClient();

  const [{ data: catData }, { data: marcasData }] = await Promise.all([
    supabase.from("productos_padre").select("categoria, subcategoria").eq("activo", true),
    supabase.from("marcas").select("id, nombre").eq("activa", true).order("nombre"),
  ]);

  const categorias = [...new Set((catData ?? []).map((p: { categoria: string }) => p.categoria))].sort() as string[];
  const subcategorias = cat
    ? ([...new Set((catData ?? []).filter((p: { categoria: string; subcategoria: string | null }) => p.categoria === cat).map((p: { subcategoria: string | null }) => p.subcategoria).filter(Boolean))].sort() as string[])
    : [];
  const marcas = (marcasData ?? []) as { id: string; nombre: string }[];

  let query = supabase
    .from("productos_padre")
    .select(
      `id, nombre, slug, categoria, subcategoria, activo, destacado, nuevo, oferta, imagen_principal_url,
       marca:marcas(id, nombre),
       variaciones:productos_variaciones(id, activa, stock, precio_b2c)`,
      { count: "exact" }
    )
    .order("nombre")
    .range(from, to);

  if (q?.trim()) {
    for (const word of q.trim().split(/\s+/).filter(Boolean)) {
      query = query.ilike("nombre", `%${word}%`);
    }
  }
  if (marca) query = query.eq("marca_id", marca);
  if (cat) query = query.eq("categoria", cat);
  if (subcat) query = query.eq("subcategoria", subcat);
  if (estado === "activo") query = query.eq("activo", true);
  else if (estado === "inactivo") query = query.eq("activo", false);
  if (flag === "oferta") query = query.eq("oferta", true);
  else if (flag === "nuevo") query = query.eq("nuevo", true);
  else if (flag === "destacado") query = query.eq("destacado", true);

  const { data: productos, count: totalCount } = await query;
  const totalPages = Math.ceil((totalCount ?? 0) / PAGE_SIZE);

  const paginaParams = (extra: Record<string, string>) =>
    new URLSearchParams({
      ...(q ? { q } : {}),
      ...(cat ? { cat } : {}),
      ...(subcat ? { subcat } : {}),
      ...(marca ? { marca } : {}),
      ...(estado ? { estado } : {}),
      ...(flag ? { flag } : {}),
      ...extra,
    }).toString();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-light text-neutral-900" style={{ fontFamily: "var(--font-cormorant)" }}>
            Productos
          </h1>
          <p className="text-sm text-neutral-400 mt-1">
            {totalCount ?? 0} resultado{(totalCount ?? 0) !== 1 ? "s" : ""} &middot; p&aacute;gina {page} de {Math.max(1, totalPages)}
          </p>
        </div>
        <Link href="/admin/productos/nuevo" className="btn-primary px-6 py-2.5 text-sm tracking-widest uppercase">
          + Nuevo producto
        </Link>
      </div>

      <Suspense>
        <FiltrosProductos
          categorias={categorias}
          marcas={marcas}
          subcategorias={subcategorias}
          currentQ={q}
          currentCat={cat}
          currentSubcat={subcat}
          currentMarca={marca}
          currentEstado={estado}
          currentFlag={flag}
        />
      </Suspense>

      <div className="bg-white border border-neutral-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50">
                <th className="text-left px-4 py-3 font-medium text-neutral-600 text-xs uppercase tracking-widest">Producto</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-600 text-xs uppercase tracking-widest hidden md:table-cell">Categor&iacute;a</th>
                <th className="text-left px-4 py-3 font-medium text-neutral-600 text-xs uppercase tracking-widest hidden xl:table-cell">URL</th>
                <th className="text-center px-4 py-3 font-medium text-neutral-600 text-xs uppercase tracking-widest">Vars / Stock</th>
                <th className="text-center px-4 py-3 font-medium text-neutral-600 text-xs uppercase tracking-widest">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {(productos ?? []).map((p) => {
                type MarcaObj = { id: string; nombre: string };
                type VarObj = { activa: boolean; stock: number; precio_b2c: number };
                const marcaObj = (Array.isArray(p.marca) ? p.marca[0] : p.marca) as MarcaObj | null;
                const varsActivas = ((p.variaciones ?? []) as VarObj[]).filter((v) => v.activa);
                const stockTotal = varsActivas.reduce((a, v) => a + (v.stock ?? 0), 0);
                const precioMin = varsActivas.length > 0 ? Math.min(...varsActivas.map((v) => v.precio_b2c ?? 0)) : 0;
                const urlPath = `/productos/${slugifyCategoria(p.categoria)}/${slugifyCategoria(p.subcategoria ?? "general")}/${p.slug}`;
                return (
                  <tr key={p.id} className="hover:bg-neutral-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {p.imagen_principal_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.imagen_principal_url} alt="" className="w-10 h-10 object-contain bg-neutral-50 border border-neutral-100 shrink-0" loading="lazy" />
                        ) : (
                          <div className="w-10 h-10 bg-neutral-100 border border-neutral-200 shrink-0" />
                        )}
                        <div>
                          <p className="font-medium text-neutral-900 line-clamp-1">{p.nombre}</p>
                          <p className="text-xs text-neutral-400">{marcaObj?.nombre ?? "Sin marca"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-neutral-600 hidden md:table-cell">
                      <span>{p.categoria}</span>
                      {p.subcategoria && <span className="text-neutral-400"> / {p.subcategoria}</span>}
                    </td>
                    <td className="px-4 py-3 hidden xl:table-cell">
                      <span className="text-xs text-neutral-400 font-mono break-all">{urlPath}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="text-sm font-medium">{varsActivas.length}</div>
                      <div className="text-xs text-neutral-400">
                        {stockTotal > 0 ? `${stockTotal} uds` : "sin stock"}
                        {precioMin > 0 && ` \u00b7 ${precioMin.toFixed(2)}\u20ac`}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block px-2 py-0.5 text-xs ${p.activo ? "bg-green-50 text-green-700 border border-green-200" : "bg-neutral-100 text-neutral-500 border border-neutral-200"}`}>
                        {p.activo ? "Activo" : "Inactivo"}
                      </span>
                      <div className="flex items-center justify-center gap-1 mt-1 flex-wrap">
                        {p.oferta && <span className="inline-block px-1.5 py-0.5 text-[10px] bg-amber-50 text-amber-700 border border-amber-200">Oferta</span>}
                        {p.destacado && <span className="inline-block px-1.5 py-0.5 text-[10px] bg-sky-50 text-sky-700 border border-sky-200">&#x2605;</span>}
                        {p.nuevo && <span className="inline-block px-1.5 py-0.5 text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200">Nuevo</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <Link href={urlPath} target="_blank" className="text-xs text-neutral-400 hover:text-neutral-700 transition-colors" title="Ver en tienda">&#x2197;</Link>
                        <GenerarSeoBtn productoId={p.id} />
                        <Link href={`/admin/productos/${p.id}`} className="text-xs text-neutral-600 hover:text-neutral-900 underline underline-offset-2 transition-colors">Editar</Link>
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

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-neutral-400">
            Mostrando {from + 1}&ndash;{Math.min(to + 1, totalCount ?? 0)} de {totalCount} productos
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={`/admin/productos?${paginaParams({ page: String(page - 1) })}`} className="px-4 py-2 text-xs border border-neutral-300 hover:border-neutral-600 transition-colors">
                &larr; Anterior
              </Link>
            )}
            {page < totalPages && (
              <Link href={`/admin/productos?${paginaParams({ page: String(page + 1) })}`} className="px-4 py-2 text-xs border border-neutral-300 hover:border-neutral-600 transition-colors">
                Siguiente &rarr;
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
