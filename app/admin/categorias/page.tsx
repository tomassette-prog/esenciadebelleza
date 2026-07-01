import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { GestionCategorias } from "./GestionCategorias";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Categorías WooCommerce | Admin",
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
    <div className="max-w-4xl">
      <GestionCategorias mappings={mappings ?? []} />
    </div>
  );
}
