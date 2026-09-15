"use client";

import { useState, useEffect } from "react";
import {
  generarFacturaDesdePedido,
  listarPedidosProfesional,
} from "@/actions/facturas";

interface Pedido {
  id: string;
  estado: string;
  total: number;
  created_at: string;
  metodo_pago: string | null;
  email_cliente: string;
}

interface Props {
  profesionalId: string;
  profesionalNombre: string;
}

export default function GenerarFactura({
  profesionalId,
  profesionalNombre,
}: Props) {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [cargandoPedidos, setCargandoPedidos] = useState(true);
  const [pedidoSeleccionado, setPedidoSeleccionado] = useState("");
  const [numeroFactura, setNumeroFactura] = useState("");
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  useEffect(() => {
    async function cargar() {
      setCargandoPedidos(true);
      const data = await listarPedidosProfesional(profesionalId);
      setPedidos(data);
      setCargandoPedidos(false);
    }
    cargar();
  }, [profesionalId]);

  async function handleGenerar(e: React.FormEvent) {
    e.preventDefault();
    if (!pedidoSeleccionado || !numeroFactura.trim()) return;

    setGenerando(true);
    setError(null);
    setExito(null);

    const res = await generarFacturaDesdePedido(
      pedidoSeleccionado,
      profesionalId,
      numeroFactura.trim()
    );

    setGenerando(false);

    if (res.error) {
      setError(res.error);
    } else {
      setExito(`Factura ${numeroFactura} generada correctamente.`);
      setNumeroFactura("");
      setPedidoSeleccionado("");
    }
  }

  function formatFecha(iso: string) {
    return new Date(iso).toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  function formatEuros(n: number) {
    return n.toFixed(2).replace(".", ",") + " €";
  }

  return (
    <div className="border border-neutral-200 rounded-lg p-5 mt-4">
      <h3 className="text-xs tracking-widest uppercase text-neutral-500 mb-4 flex items-center gap-2">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m5.231 13.481L15 17.25m-4.5-15H5.625c-.621 0-1.125.504-1.125 1.125v16.5c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9zm3.75 11.625a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
        </svg>
        Generar factura para {profesionalNombre}
      </h3>

      <form onSubmit={handleGenerar} className="space-y-4">
        {/* Selector de pedido */}
        <div>
          <label className="block text-xs tracking-wider uppercase text-neutral-600 mb-1.5">
            Seleccionar pedido
          </label>
          {cargandoPedidos ? (
            <p className="text-sm text-neutral-400">Cargando pedidos...</p>
          ) : pedidos.length === 0 ? (
            <p className="text-sm text-neutral-400">Sin pedidos</p>
          ) : (
            <select
              value={pedidoSeleccionado}
              onChange={(e) => setPedidoSeleccionado(e.target.value)}
              required
              className="w-full border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:border-neutral-900 transition-colors rounded bg-white"
            >
              <option value="">— Selecciona un pedido —</option>
              {pedidos.map((p) => (
                <option key={p.id} value={p.id}>
                  #{p.id.slice(0, 8).toUpperCase()} · {formatFecha(p.created_at)} · {formatEuros(p.total)} · {p.estado}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Número de factura */}
        <div>
          <label className="block text-xs tracking-wider uppercase text-neutral-600 mb-1.5">
            Número de factura (de depeluqueria)
          </label>
          <input
            type="text"
            value={numeroFactura}
            onChange={(e) => setNumeroFactura(e.target.value)}
            placeholder="Ej: EB-2026-0532"
            required
            className="w-full border border-neutral-200 px-3 py-2 text-sm focus:outline-none focus:border-neutral-900 transition-colors rounded"
          />
        </div>

        {/* Botón */}
        <button
          type="submit"
          disabled={generando || !pedidoSeleccionado || !numeroFactura.trim()}
          className="px-5 py-2.5 bg-neutral-900 text-white text-xs tracking-widest uppercase font-medium hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors rounded"
        >
          {generando ? "Generando..." : "Generar factura"}
        </button>
      </form>

      {/* Mensajes */}
      {error && (
        <div className="mt-3 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded">
          {error}
        </div>
      )}
      {exito && (
        <div className="mt-3 p-3 bg-green-50 border border-green-200 text-green-700 text-sm rounded">
          ✓ {exito}
        </div>
      )}
    </div>
  );
}
