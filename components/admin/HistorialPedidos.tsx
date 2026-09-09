"use client";

import { useState } from "react";

interface Pedido {
  id: string;
  estado: string;
  total: number;
  tipo_precio: string;
  metodo_pago: string | null;
  created_at: string;
}

interface Props {
  pedidos: Pedido[];
  totalGastado: number;
}

export function HistorialPedidos({ pedidos, totalGastado }: Props) {
  const [abierto, setAbierto] = useState(false);

  if (pedidos.length === 0) {
    return (
      <span className="text-xs text-neutral-400">Sin pedidos</span>
    );
  }

  const estadoColor: Record<string, string> = {
    pendiente: "bg-yellow-100 text-yellow-800",
    pagado: "bg-blue-100 text-blue-800",
    preparando: "bg-purple-100 text-purple-800",
    enviado: "bg-indigo-100 text-indigo-800",
    entregado: "bg-green-100 text-green-800",
    cancelado: "bg-red-100 text-red-800",
    reembolsado: "bg-gray-100 text-gray-800",
  };

  return (
    <div>
      <button
        onClick={() => setAbierto(!abierto)}
        className="text-xs text-neutral-600 hover:text-neutral-900 transition-colors flex items-center gap-1"
      >
        <span className="font-medium">{pedidos.length} pedido{pedidos.length !== 1 ? "s" : ""}</span>
        <span className="text-neutral-400">· {totalGastado.toFixed(2)} €</span>
        <svg
          className={`w-3 h-3 transition-transform ${abierto ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {abierto && (
        <div className="mt-2 border border-neutral-100 rounded overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-neutral-50">
                <th className="text-left px-3 py-1.5 font-normal text-neutral-500">Fecha</th>
                <th className="text-left px-3 py-1.5 font-normal text-neutral-500">Estado</th>
                <th className="text-left px-3 py-1.5 font-normal text-neutral-500">Pago</th>
                <th className="text-right px-3 py-1.5 font-normal text-neutral-500">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-50">
              {pedidos.map((p) => (
                <tr key={p.id} className="hover:bg-neutral-50">
                  <td className="px-3 py-1.5 text-neutral-600">
                    {new Date(p.created_at).toLocaleDateString("es-ES")}
                  </td>
                  <td className="px-3 py-1.5">
                    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${estadoColor[p.estado] ?? "bg-neutral-100"}`}>
                      {p.estado}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 text-neutral-500">{p.metodo_pago ?? "—"}</td>
                  <td className="px-3 py-1.5 text-right font-medium text-neutral-700">{p.total.toFixed(2)} €</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
