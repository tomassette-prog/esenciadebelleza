import type { Metadata } from "next";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { ProductoForm } from "@/components/admin/ProductoForm";
import { crearProducto } from "@/actions/productos";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Nuevo producto | Admin",
  robots: { index: false, follow: false },
};

export default async function NuevoProductoPage() {
  const supabase = createAdminClient();

  const [{ data: marcas }, { data: catData }] = await Promise.all([
    supabase.from("marcas").select("id, nombre, slug, logo_url, activa").eq("activa", true).order("nombre"),
    supabase.from("productos_padre").select("categoria, subcategoria").eq("activo", true),
  ]);

  const categorias = [...new Set((catData ?? []).map((p) => p.categoria))].sort();

  // Mapa categoria -> subcategoriasúnicos ordenados
  const subcategoriasPorCategoria: Record<string, string[]> = {};
  for (const p of catData ?? []) {
    if (!p.subcategoria) continue;
    if (!subcategoriasPorCategoria[p.categoria]) subcategoriasPorCategoria[p.categoria] = [];
    if (!subcategoriasPorCategoria[p.categoria].includes(p.subcategoria))
      subcategoriasPorCategoria[p.categoria].push(p.subcategoria);
  }
  Object.values(subcategoriasPorCategoria).forEach(arr => arr.sort());

  return (
    <div className="max-w-3xl space-y-6">
      {/* Volver */}
      <div className="flex items-center gap-3">
        <Link
          href="/admin/productos"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs border border-neutral-300 text-neutral-600 hover:border-neutral-600 hover:text-neutral-900 transition-colors"
        >
          ← Volver al listado
        </Link>
        <span className="text-neutral-300">/</span>
        <span className="text-sm text-neutral-600">Nuevo producto</span>
      </div>

      <div>
        <h1 className="text-2xl font-light text-neutral-900" style={{ fontFamily: "var(--font-cormorant)" }}>
          Nuevo producto
        </h1>
        <p className="text-sm text-neutral-400 mt-1">
          La URL SEO se genera automáticamente a partir del nombre y la categoría.
        </p>
      </div>

      <ProductoForm
        action={crearProducto}
        marcas={marcas ?? []}
        categoriasExistentes={categorias}
        subcategoriasPorCategoria={subcategoriasPorCategoria}
        modo="crear"
      />
    </div>
  );
}
