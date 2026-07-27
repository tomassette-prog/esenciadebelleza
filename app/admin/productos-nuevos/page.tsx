import type { Metadata } from "next";
import { ProductosNuevosClient } from "@/components/admin/ProductosNuevosClient";
import { getProductosNuevos } from "@/actions/productos-nuevos";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Productos Nuevos | Admin",
  robots: { index: false, follow: false },
};

export default async function ProductosNuevosPage() {
  const { productos, clearedAt, error } = await getProductosNuevos();

  return (
    <div className="max-w-6xl">
      <ProductosNuevosClient
        initialProductos={productos}
        clearedAt={clearedAt}
        initialError={error}
      />
    </div>
  );
}
