"use client";

import { useCarrito } from "@/context/CarritoContext";

export function BotonesCarritoHeader() {
  const { totalUnidades, abrirDrawer } = useCarrito();

  return (
    <button
      onClick={abrirDrawer}
      className="relative p-2 text-neutral-500 hover:text-neutral-900 transition-colors"
      aria-label={`Carrito${totalUnidades > 0 ? ` (${totalUnidades} artículos)` : ""}`}
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007z"
        />
      </svg>

      {/* Badge contador */}
      {totalUnidades > 0 && (
        <span
          className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-neutral-900 text-white text-[10px] font-medium rounded-full flex items-center justify-center px-1 tabular-nums"
          aria-hidden="true"
        >
          {totalUnidades > 99 ? "99+" : totalUnidades}
        </span>
      )}
    </button>
  );
}
