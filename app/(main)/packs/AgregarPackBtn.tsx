"use client";

import { useCarrito } from "@/context/CarritoContext";
import type { PackRegaloCompleto } from "@/types/producto";

export function AgregarPackBtn({ pack }: { pack: PackRegaloCompleto }) {
  const { agregarPack, abrirDrawer } = useCarrito();

  const agotado = pack.stock_disponible === 0;

  function handleAgregar() {
    if (agotado) return;
    agregarPack({
      pack_id:    pack.id,
      slug:       pack.slug,
      nombre:     pack.nombre,
      imagen_url: pack.imagen_url,
      precio:     pack.precio_pack,
      items:      pack.items.map((i) => ({
        variacion_id: i.variacion_id,
        sku:          i.variacion?.sku ?? "",
        cantidad:     i.cantidad,
      })),
    });
    abrirDrawer();
  }

  return (
    <button
      onClick={handleAgregar}
      disabled={agotado}
      className="w-full py-4 bg-[#3D2018] text-white text-xs tracking-widest uppercase hover:bg-neutral-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
    >
      {agotado ? "Agotado" : "Añadir al carrito"}
    </button>
  );
}
