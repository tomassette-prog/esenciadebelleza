"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { slugifyCategoria, formatPrice } from "@/lib/seo";

interface Producto {
  id: string;
  nombre: string;
  slug: string;
  categoria: string;
  subcategoria: string | null;
  imagen_principal_url: string | null;
  seo_description: string | null;
  productos_variaciones: { precio_b2c: number }[];
}

interface MarcaProductosClientProps {
  productos: Producto[];
  marcaNombre: string;
}

export function MarcaProductosClient({ productos, marcaNombre }: MarcaProductosClientProps) {
  const [filtroSubcategoria, setFiltroSubcategoria] = useState<string | null>(null);

  // Extraer categorías y subcategorías únicas
  const categorias = useMemo(() => {
    const map = new Map<string, Set<string | null>>();

    productos.forEach((p) => {
      if (!map.has(p.categoria)) {
        map.set(p.categoria, new Set());
      }
      map.get(p.categoria)!.add(p.subcategoria);
    });

    // Convertir a array y ordenar
    return Array.from(map.entries())
      .map(([cat, subs]) => ({
        categoria: cat,
        subcategorias: Array.from(subs)
          .filter(Boolean)
          .sort() as string[],
      }))
      .sort((a, b) => a.categoria.localeCompare(b.categoria));
  }, [productos]);

  // Filtrar productos
  const productosFiltrados = useMemo(() => {
    if (!filtroSubcategoria) return productos;
    return productos.filter((p) => p.subcategoria === filtroSubcategoria);
  }, [productos, filtroSubcategoria]);

  // Todas las subcategorías disponibles en estos productos
  const todasSubcategorias = useMemo(() => {
    const set = new Set<string>();
    productos.forEach((p) => {
      if (p.subcategoria) set.add(p.subcategoria);
    });
    return Array.from(set).sort();
  }, [productos]);

  return (
    <div className="container-main py-12">
      {/* Cabecera de marca */}
      <div className="flex items-end gap-6 mb-12 pb-8 border-b border-neutral-100">
        <div>
          <h1
            className="text-4xl font-light text-neutral-900 mb-2"
            style={{ fontFamily: "var(--font-cormorant)" }}
          >
            {marcaNombre}
          </h1>
          <div className="w-12 h-px mb-3" style={{ backgroundColor: "var(--color-oro)" }} />
        </div>
        <span className="ml-auto text-xs text-neutral-400 shrink-0">
          {productosFiltrados.length} de {productos.length} productos
        </span>
      </div>

      {/* Filtros dinámicos */}
      {todasSubcategorias.length > 0 && (
        <div className="mb-8">
          <p className="text-sm text-neutral-600 mb-3 font-medium">Filtrar por:</p>
          <div className="flex flex-wrap gap-2">
            {/* Botón "Todos" */}
            <button
              onClick={() => setFiltroSubcategoria(null)}
              className={`px-4 py-2 text-sm transition-colors border ${
                filtroSubcategoria === null
                  ? "bg-neutral-900 text-white border-neutral-900"
                  : "bg-white text-neutral-900 border-neutral-200 hover:border-neutral-900"
              }`}
            >
              Todos ({productos.length})
            </button>

            {/* Botones por subcategoría */}
            {todasSubcategorias.map((sub) => {
              const count = productos.filter((p) => p.subcategoria === sub).length;
              return (
                <button
                  key={sub}
                  onClick={() => setFiltroSubcategoria(sub)}
                  className={`px-4 py-2 text-sm transition-colors border ${
                    filtroSubcategoria === sub
                      ? "bg-neutral-900 text-white border-neutral-900"
                      : "bg-white text-neutral-900 border-neutral-200 hover:border-neutral-900"
                  }`}
                >
                  {sub} ({count})
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Grid de productos */}
      {productosFiltrados.length === 0 ? (
        <p className="text-sm text-neutral-400">
          No hay productos disponibles con este filtro.
        </p>
      ) : (
        <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-px bg-neutral-100">
          {productosFiltrados.map((p) => {
            const precios = (p.productos_variaciones as { precio_b2c: number }[] ?? []).map(
              (v) => v.precio_b2c
            );
            const precioDesde = precios.length > 0 ? Math.min(...precios) : null;
            const href = `/productos/${slugifyCategoria(p.categoria)}/${slugifyCategoria(
              p.subcategoria ?? "general"
            )}/${p.slug}`;

            return (
              <li key={p.id}>
                <Link
                  href={href}
                  className="flex flex-col bg-white hover:bg-neutral-50 transition-colors group"
                >
                  {/* Imagen */}
                  <div className="aspect-square overflow-hidden bg-neutral-50">
                    {p.imagen_principal_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.imagen_principal_url}
                        alt={p.nombre}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="w-8 h-px" style={{ backgroundColor: "var(--color-oro)" }} />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-4">
                    <p
                      className="text-sm font-light text-neutral-900 leading-snug mb-2 line-clamp-2"
                      style={{ fontFamily: "var(--font-cormorant)", fontSize: "1rem" }}
                    >
                      {p.nombre}
                    </p>
                    {precioDesde && (
                      <p className="text-xs text-neutral-500">
                        <span className="text-neutral-900 font-medium">
                          {formatPrice(precioDesde)}
                        </span>
                      </p>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
