"use client";

import { useCarrito } from "@/context/CarritoContext";

interface Props {
  variacionId: string;
  productoId: string;
  slug: string;
  categoria: string;
  subcategoria: string;
  nombre: string;
  nombreVariacion: string;
  imagenUrl: string | null;
  precio: number;
  sku: string;
}

export function AnadirAlCarritoBtn({
  variacionId,
  productoId,
  slug,
  categoria,
  subcategoria,
  nombre,
  nombreVariacion,
  imagenUrl,
  precio,
  sku,
}: Props) {
  const { agregar } = useCarrito();

  function handleClick() {
    agregar({
      variacion_id: variacionId,
      producto_id: productoId,
      slug,
      categoria,
      subcategoria,
      nombre,
      nombre_variacion: nombreVariacion,
      imagen_url: imagenUrl,
      precio,
      sku,
    });
  }

  return (
    <button onClick={handleClick} className="btn-primary w-full py-4 text-base">
      Añadir al carrito
    </button>
  );
}
