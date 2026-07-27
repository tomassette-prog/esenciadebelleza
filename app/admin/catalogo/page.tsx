import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { GestionSubcategorias } from "../categorias/GestionSubcategorias";
import { GestionCategorias } from "../categorias/GestionCategorias";
import { MarcasAdmin } from "../marcas/MarcasAdmin";
import { getAllCategoriaPairs } from "@/lib/category-suggester";
import { CatalogoTabs } from "./CatalogoTabs";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Catálogo | Admin",
  robots: { index: false, follow: false },
};

export default async function CatalogoPage() {
  const supa = createAdminClient();

  const [{ data: mappings }, allPairs, { data: marcas }] = await Promise.all([
    supa.from("woo_cat_mappings")
      .select("woo_cat_id, woo_cat_name, categoria, subcategoria")
      .order("categoria")
      .order("subcategoria"),
    getAllCategoriaPairs(),
    supa.from("marcas")
      .select("id, nombre, slug, logo_url, activa")
      .order("nombre"),
  ]);

  return (
    <div className="max-w-6xl">
      <CatalogoTabs
        subcategoriasContent={<GestionSubcategorias />}
        categoriasContent={<GestionCategorias mappings={mappings ?? []} allPairs={allPairs} />}
        marcasContent={<MarcasAdmin marcas={marcas ?? []} />}
      />
    </div>
  );
}
