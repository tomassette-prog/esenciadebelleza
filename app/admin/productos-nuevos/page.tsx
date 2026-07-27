import type { Metadata } from "next";
import { ProductosNuevosClient } from "@/components/admin/ProductosNuevosClient";
import { getProductosNuevos } from "@/actions/productos-nuevos";
import { getAllCategoriaPairs } from "@/lib/category-suggester";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Productos Nuevos | Admin",
  robots: { index: false, follow: false },
};

export default async function ProductosNuevosPage() {
  const [{ productos, clearedAt, error }, allPairs] = await Promise.all([
    getProductosNuevos(),
    getAllCategoriaPairs(),
  ]);

  return (
    <div className="max-w-6xl">
      <ProductosNuevosClient
        initialProductos={productos}
        clearedAt={clearedAt}
        initialError={error}
        allPairs={allPairs}
      />
    </div>
  );
}
