"use client";

import { useEffect } from "react";

// Restores an abandoned cart snapshot into localStorage and jumps to checkout.

type ItemCarrito = {
  variacion_id: string; producto_id: string; slug: string; categoria: string;
  subcategoria: string | null; nombre: string; nombre_variacion: string;
  imagen_url: string | null; precio: number; precio_original?: number;
  cantidad: number; sku: string;
};

export function RestaurarCarrito({ items }: { items: ItemCarrito[] }) {
  useEffect(() => {
    try {
      localStorage.setItem("esencia_carrito_v1", JSON.stringify(items));
      window.location.href = "/checkout";
    } catch {
      /* localStorage no disponible */
    }
  }, [items]);

  return (
    <div className="container-main py-20 text-center">
      <p className="text-neutral-600">Recuperando tu carrito…</p>
    </div>
  );
}
