import Link from "next/link";
import Image from "next/image";
import type { ProductoCatalogo } from "@/types/producto";
import { formatPrice, slugifyCategoria } from "@/lib/seo";

interface Props {
  producto: ProductoCatalogo;
  priority?: boolean;
}

export function ProductoCard({ producto, priority = false }: Props) {
  const href = `/productos/${slugifyCategoria(producto.categoria)}/${slugifyCategoria(producto.subcategoria ?? "general")}/${producto.slug}`;

  return (
    <Link href={href} className="group block" prefetch={false}>
      {/* Imagen */}
      <div className="relative aspect-square bg-neutral-50 overflow-hidden mb-3">
        {producto.imagen_principal_url ? (
          <Image
            src={producto.imagen_principal_url}
            alt={producto.nombre}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-contain transition-transform duration-500 group-hover:scale-105"
            priority={priority}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-neutral-200 text-xs tracking-widest uppercase">Sin imagen</span>
          </div>
        )}

        {/* Badges */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {producto.nuevo && (
            <span className="badge-nuevo">Nuevo</span>
          )}
          {producto.destacado && (
            <span className="badge-destacado">Destacado</span>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="space-y-1">
        {producto.marca_nombre && (
          <p className="text-[10px] tracking-widest uppercase text-neutral-400">
            {producto.marca_nombre}
          </p>
        )}
        <h3 className="text-sm text-neutral-800 leading-snug line-clamp-2 group-hover:text-neutral-900 transition-colors">
          {producto.nombre}
        </h3>
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium text-neutral-900">
            {producto.precio_desde > 0
              ? `Desde ${formatPrice(producto.precio_desde)}`
              : "Consultar precio"}
          </span>
          {producto.total_variaciones > 1 && (
            <span className="text-xs text-neutral-400">
              {producto.total_variaciones} opciones
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
