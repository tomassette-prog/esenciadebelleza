import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { ProductoForm } from "@/components/admin/ProductoForm";
import { VariacionesManager } from "@/components/admin/VariacionesManager";
import { EliminarProductoBtn } from "@/components/admin/EliminarProductoBtn";
import { actualizarProducto } from "@/actions/productos";
import { slugifyCategoria } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const supabase = createAdminClient();
  const { data } = await supabase.from("productos_padre").select("nombre").eq("id", id).single();
  return {
    title: data ? `${data.nombre} | Admin` : "Editar producto | Admin",
    robots: { index: false, follow: false },
  };
}

export default async function EditarProductoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createAdminClient();

  const [{ data: producto }, { data: marcas }, { data: catData }] = await Promise.all([
    supabase
      .from("productos_padre")
      .select(`*, variaciones:productos_variaciones(*)`)
      .eq("id", id)
      .single(),
    supabase.from("marcas").select("id, nombre, slug, logo_url, activa").eq("activa", true).order("nombre"),
    supabase.from("productos_padre").select("categoria, subcategoria").eq("activo", true),
  ]);

  if (!producto) notFound();

  const categorias = [...new Set((catData ?? []).map((p: { categoria: string }) => p.categoria))].sort();

  const subcategoriasPorCategoria: Record<string, string[]> = {};
  for (const p of (catData ?? []) as { categoria: string; subcategoria: string | null }[]) {
    if (!p.subcategoria) continue;
    if (!subcategoriasPorCategoria[p.categoria]) subcategoriasPorCategoria[p.categoria] = [];
    if (!subcategoriasPorCategoria[p.categoria].includes(p.subcategoria))
      subcategoriasPorCategoria[p.categoria].push(p.subcategoria);
  }
  Object.values(subcategoriasPorCategoria).forEach(arr => arr.sort());

  const urlPreview = `/productos/${slugifyCategoria(producto.categoria)}/${slugifyCategoria(producto.subcategoria ?? "general")}/${producto.slug}`;

  // Binding del server action con el id del producto
  const accionActualizar = actualizarProducto.bind(null, id);

  return (
    <div className="max-w-3xl space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-neutral-500">
          <Link href="/admin/productos" className="hover:text-neutral-900 transition-colors">
            Productos
          </Link>
          <span>/</span>
          <span className="text-neutral-900 line-clamp-1">{producto.nombre}</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={urlPreview}
            target="_blank"
            className="text-xs text-neutral-500 hover:text-neutral-900 transition-colors"
          >
            Ver en tienda ↗
          </Link>
          <EliminarProductoBtn id={id} nombre={producto.nombre} />
        </div>
      </div>

      {/* URL actual */}
      <div className="bg-neutral-50 border border-neutral-200 px-4 py-3 text-xs font-mono text-neutral-500 flex items-center justify-between gap-4">
        <span className="truncate">esenciadebelleza.es{urlPreview}</span>
        <span
          className={`shrink-0 px-2 py-0.5 text-xs ${
            producto.activo ? "bg-green-50 text-green-700 border border-green-200" : "bg-neutral-100 text-neutral-500 border border-neutral-200"
          }`}
        >
          {producto.activo ? "Activo" : "Inactivo"}
        </span>
      </div>

      {/* Formulario */}
      <ProductoForm
        action={accionActualizar as Parameters<typeof ProductoForm>[0]["action"]}
        marcas={marcas ?? []}
        categoriasExistentes={categorias as string[]}
        subcategoriasPorCategoria={subcategoriasPorCategoria}
        modo="editar"
        productoId={id}
        defaultValues={{
          nombre: producto.nombre,
          categoria: producto.categoria,
          subcategoria: producto.subcategoria ?? "",
          marca_id: producto.marca_id ?? "",
          descripcion: producto.descripcion_general ?? "",
          imagen_url: producto.imagen_principal_url ?? "",
          seo_title: producto.seo_title ?? "",
          seo_description: producto.seo_description ?? "",
          destacado: producto.destacado,
          nuevo: producto.nuevo,
          oferta: (producto as Record<string, unknown>).oferta as boolean ?? false,
          activo: producto.activo,
        }}
      />

      {/* Gestión de variaciones */}
      <VariacionesManager
        productoId={id}
        variacionesIniciales={producto.variaciones ?? []}
      />
    </div>
  );
}
