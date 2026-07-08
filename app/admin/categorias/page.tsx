import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { GestionCategorias } from "./GestionCategorias";
import { GestionSubcategorias } from "./GestionSubcategorias";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Categorías | Admin",
  robots: { index: false, follow: false },
};

export default async function CategoriasPage() {
  const supa = createAdminClient();
  const { data: mappings } = await supa
    .from("woo_cat_mappings")
    .select("woo_cat_id, woo_cat_name, categoria, subcategoria")
    .order("categoria")
    .order("subcategoria");

  return (
    <div className="space-y-16">
      {/* Sección: Gestión de Subcategorías */}
      <div className="max-w-5xl">
        <GestionSubcategorias />
      </div>

      {/* Sección: Mapeos WooCommerce */}
      <div className="max-w-4xl border-t border-neutral-200 pt-16">
        <GestionCategorias mappings={mappings ?? []} />
      </div>
    </div>
  );
}
