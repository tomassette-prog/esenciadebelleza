"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useCarrito } from "@/context/CarritoContext";

export function CarritoDrawer() {
  const { lineas, abierto, totalPrecio, totalUnidades, quitar, cambiarCantidad, cerrarDrawer } =
    useCarrito();

  // Cerrar con Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") cerrarDrawer();
    }
    if (abierto) document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [abierto, cerrarDrawer]);

  // Bloquear scroll del body cuando está abierto
  useEffect(() => {
    document.body.style.overflow = abierto ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [abierto]);

  const panelRef = useRef<HTMLDivElement>(null);

  return (
    <>
      {/* Overlay */}
      <div
        aria-hidden="true"
        onClick={cerrarDrawer}
        className={`fixed inset-0 bg-black/40 z-50 transition-opacity duration-300 ${
          abierto ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      />

      {/* Panel lateral */}
      <div
        ref={panelRef}
        role="dialog"
        aria-label="Carrito de compra"
        aria-modal="true"
        className={`fixed top-0 right-0 h-full w-full max-w-md bg-white z-50 flex flex-col shadow-2xl transition-transform duration-300 ${
          abierto ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Cabecera */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-neutral-100">
          <h2 className="text-sm tracking-widest uppercase font-medium text-neutral-900">
            Carrito
            {totalUnidades > 0 && (
              <span className="ml-2 text-xs text-neutral-400 normal-case font-normal">
                ({totalUnidades} {totalUnidades === 1 ? "artículo" : "artículos"})
              </span>
            )}
          </h2>
          <button
            onClick={cerrarDrawer}
            className="p-2 text-neutral-400 hover:text-neutral-900 transition-colors"
            aria-label="Cerrar carrito"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Líneas */}
        {lineas.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
            <svg className="w-16 h-16 text-neutral-200 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007z" />
            </svg>
            <p className="text-sm text-neutral-500 mb-6">Tu carrito está vacío</p>
            <button
              onClick={cerrarDrawer}
              className="text-xs tracking-widest uppercase border border-neutral-900 px-6 py-2 hover:bg-neutral-900 hover:text-white transition-colors"
            >
              Seguir comprando
            </button>
          </div>
        ) : (
          <>
            <ul className="flex-1 overflow-y-auto divide-y divide-neutral-100 px-6">
              {lineas.map((linea) => (
                <li key={linea.variacion_id} className="py-5 flex gap-4">
                  {/* Imagen */}
                  <div className="w-20 h-20 bg-neutral-50 border border-neutral-100 shrink-0 relative overflow-hidden">
                    {linea.imagen_url ? (
                      <Image
                        src={linea.imagen_url}
                        alt={linea.nombre}
                        fill
                        sizes="80px"
                        className="object-contain p-1"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-neutral-300">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                            d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3 9.75A.75.75 0 013.75 9h16.5a.75.75 0 01.75.75v9a.75.75 0 01-.75.75H3.75A.75.75 0 013 18.75V9.75z" />
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/productos/${linea.categoria}/${linea.subcategoria}/${linea.slug}`}
                      onClick={cerrarDrawer}
                      className="text-sm text-neutral-900 hover:underline line-clamp-2 leading-snug"
                    >
                      {linea.nombre}
                    </Link>
                    {linea.nombre_variacion && linea.nombre_variacion !== "Unidad" && (
                      <p className="text-xs text-neutral-400 mt-0.5">{linea.nombre_variacion}</p>
                    )}

                    <div className="flex items-center justify-between mt-3">
                      {/* Cantidad */}
                      <div className="flex items-center border border-neutral-200">
                        <button
                          onClick={() => cambiarCantidad(linea.variacion_id, linea.cantidad - 1)}
                          className="w-8 h-8 flex items-center justify-center text-neutral-400 hover:text-neutral-900 hover:bg-neutral-50 transition-colors"
                          aria-label="Reducir cantidad"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                          </svg>
                        </button>
                        <span className="w-8 text-center text-sm tabular-nums">{linea.cantidad}</span>
                        <button
                          onClick={() => cambiarCantidad(linea.variacion_id, linea.cantidad + 1)}
                          className="w-8 h-8 flex items-center justify-center text-neutral-400 hover:text-neutral-900 hover:bg-neutral-50 transition-colors"
                          aria-label="Aumentar cantidad"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                        </button>
                      </div>

                      {/* Precio */}
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium tabular-nums">
                          {(linea.precio * linea.cantidad).toLocaleString("es-ES", {
                            style: "currency", currency: "EUR",
                          })}
                        </span>
                        <button
                          onClick={() => quitar(linea.variacion_id)}
                          className="text-neutral-300 hover:text-red-500 transition-colors"
                          aria-label={`Eliminar ${linea.nombre}`}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                              d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            {/* Footer — Total y checkout */}
            <div className="border-t border-neutral-100 px-6 py-5 space-y-4">
              {/* Subtotal */}
              <div className="flex justify-between text-sm">
                <span className="text-neutral-500">Subtotal</span>
                <span className="font-medium tabular-nums">
                  {totalPrecio.toLocaleString("es-ES", { style: "currency", currency: "EUR" })}
                </span>
              </div>
              <p className="text-xs text-neutral-400">
                Envío e impuestos calculados en el siguiente paso
              </p>

              {/* CTA Checkout */}
              <Link
                href="/checkout"
                onClick={cerrarDrawer}
                className="block w-full py-4 bg-neutral-900 text-white text-xs tracking-widest uppercase text-center hover:bg-neutral-700 transition-colors"
              >
                Finalizar compra
              </Link>

              {/* Seguir comprando */}
              <button
                onClick={cerrarDrawer}
                className="block w-full text-center text-xs text-neutral-400 hover:text-neutral-700 transition-colors py-1"
              >
                Seguir comprando
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
