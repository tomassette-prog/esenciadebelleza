import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { slugifyCategoria } from "@/lib/seo";
import { FiltrosProductos } from "./FiltrosProductos";
import { GenerarSeoBulkBtn } from "./GenerarSeoBulkBtn";
import { ProductosTableClient } from "./ProductosTableClient";

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
        <GenerarSeoBulkBtn categoria={cat} />
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

      <ProductosTableClient
        productos={(productos ?? []) as Parameters<typeof ProductosTableClient>[0]["productos"]}
        slugifyCategoria={slugifyCategoria}
      />

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
