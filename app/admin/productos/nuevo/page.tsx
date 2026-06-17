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
    supabase.from("productos_padre").select("categoria").eq("activo", true),
  ]);

  const categorias = [...new Set((catData ?? []).map((p) => p.categoria))].sort();

  return (
    <div className="max-w-3xl space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-neutral-500">
        <Link href="/admin/productos" className="hover:text-neutral-900 transition-colors">
          Productos
        </Link>
        <span>/</span>
        <span className="text-neutral-900">Nuevo producto</span>
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
        modo="crear"
      />
    </div>
  );
}
