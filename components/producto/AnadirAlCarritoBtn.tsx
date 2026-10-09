"use client";

import { useCarrito } from "@/context/CarritoContext";
import { trackEventoMeta, trackEventoGA } from "@/components/layout/MetaPixel";

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
  precioOriginal?: number;
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
  precioOriginal,
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
      precio_original: precioOriginal,
      sku,
    });
    trackEventoMeta("AddToCart", { value: precio.toFixed(2), currency: "EUR" });
    trackEventoGA("add_to_cart", { currency: "EUR", value: precio, items: [{ item_id: sku, item_name: nombre, price: precio }] });
  }

  return (
    <button onClick={handleClick} className="btn-primary w-full py-4 text-base">
      Añadir al carrito
    </button>
  );
}
