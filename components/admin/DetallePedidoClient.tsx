"use client";

import { useState } from "react";
import { actualizarComision, actualizarEstadoPedido, lanzarPedidoWoo } from "@/actions/pedidos";
import { useRouter } from "next/navigation";

const ESTADOS = [
  "pendiente", "pagado", "preparando", "enviado", "entregado", "cancelado", "reembolsado",
];

interface Linea {
  id: string;
  sku: string;
  nombre_producto: string;
  nombre_variacion?: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
}

interface Pedido {
  id: string;
  estado: string;
  total: number;
  subtotal: number;
  gastos_envio: number;
  coste_proveedor?: number;
  ganancia_neta?: number;
  notas_internas?: string;
  woo_order_id?: number;
  woo_estado?: string;
  woo_enviado_at?: string;
  metodo_pago?: string;
  email_cliente: string;
  direccion_envio: Record<string, string>;
  created_at: string;
  tipo_precio: string;
  pedidos_lineas: Linea[];
}

export default function DetallePedidoClient({ pedido }: { pedido: Pedido }) {
  const router = useRouter();
  const [coste, setCoste]       = useState(pedido.coste_proveedor?.toString() ?? "");
  const [ganancia, setGanancia] = useState(pedido.ganancia_neta?.toString() ?? "");
  const [notas, setNotas]       = useState(pedido.notas_internas ?? "");
  const [estado, setEstado]     = useState(pedido.estado);
  const [saving, setSaving]     = useState(false);
  const [launching, setLaunching] = useState(false);
  const [msg, setMsg]           = useState<{ type: "ok" | "error"; text: string } | null>(null);

  // Auto-calcular ganancia cuando cambia el coste
  function handleCosteChange(val: string) {
    setCoste(val);
    const c = parseFloat(val);
    if (!isNaN(c)) {
      const g = pedido.total - (pedido.gastos_envio ?? 0) - c;
      setGanancia(g.toFixed(2));
    }
  }

  async function guardar() {
    setSaving(true);
    setMsg(null);
    const [r1, r2] = await Promise.all([
      actualizarComision(pedido.id, {
        coste_proveedor: coste ? parseFloat(coste) : undefined,
        ganancia_neta:   ganancia ? parseFloat(ganancia) : undefined,
        notas_internas:  notas || undefined,
      }),
      actualizarEstadoPedido(pedido.id, estado),
    ]);
    setSaving(false);
    if (r1.error || r2.error) {
      setMsg({ type: "error", text: r1.error ?? r2.error ?? "Error" });
    } else {
      setMsg({ type: "ok", text: "Guardado correctamente" });
      router.refresh();
    }
  }

  async function lanzarWoo() {
    if (!confirm("¿Confirmas que quieres crear este pedido en depeluqueriaproductos.com?")) return;
    setLaunching(true);
    setMsg(null);
    const r = await lanzarPedidoWoo(pedido.id);
    setLaunching(false);
    if (r.error) {
      setMsg({ type: "error", text: r.error });
    } else {
      setMsg({ type: "ok", text: `Pedido creado en WooCommerce con ID #${(r as { wooId?: number }).wooId}` });
      router.refresh();
    }
  }

  const dir = pedido.direccion_envio ?? {};

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Cabecera */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Pedido <span className="font-mono text-base text-gray-500">#{pedido.id.slice(0, 8).toUpperCase()}</span>
          </h1>
          <p className="text-sm text-gray-500">
            {new Date(pedido.created_at).toLocaleString("es-ES")} · {pedido.email_cliente} · {pedido.tipo_precio.toUpperCase()}
          </p>
        </div>
        <button
          onClick={() => router.back()}
          className="text-sm text-gray-500 hover:text-gray-700 border border-gray-200 px-3 py-1 rounded-lg"
        >
          ← Volver
        </button>
      </div>

      {msg && (
        <div className={`rounded-lg px-4 py-3 text-sm font-medium ${msg.type === "ok" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
          {msg.text}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Dirección */}
        <div className="bg-white rounded-xl shadow p-5 space-y-1">
          <h2 className="font-semibold text-gray-700 mb-3">Dirección de envío</h2>
          <p className="text-gray-900 font-medium">{dir.nombre} {dir.apellidos}</p>
          <p className="text-gray-600">{dir.direccion}</p>
          <p className="text-gray-600">{dir.codigo_postal} {dir.ciudad} ({dir.provincia})</p>
          <p className="text-gray-500 text-sm">{dir.telefono}</p>
          <p className="text-gray-500 text-sm">{pedido.email_cliente}</p>
        </div>

        {/* Resumen económico */}
        <div className="bg-white rounded-xl shadow p-5 space-y-2">
          <h2 className="font-semibold text-gray-700 mb-3">Resumen económico</h2>
          <Row label="Subtotal productos" value={`${pedido.subtotal.toFixed(2)} €`} />
          <Row label="Gastos de envío"    value={`${pedido.gastos_envio.toFixed(2)} €`} />
          <Row label="TOTAL cliente"      value={`${pedido.total.toFixed(2)} €`} bold />
          <hr />
          <Row label="Coste proveedor"    value={coste ? `${parseFloat(coste).toFixed(2)} €` : "—"} color="text-red-600" />
          <Row label="Ganancia neta"      value={ganancia ? `${parseFloat(ganancia).toFixed(2)} €` : "—"} color="text-green-600" bold />
          {pedido.woo_order_id && (
            <a
              href={`https://depeluqueriaproductos.com/wp-admin/post.php?post=${pedido.woo_order_id}&action=edit`}
              target="_blank"
              rel="noopener noreferrer"
              className="block mt-2 text-xs text-indigo-600 hover:underline"
            >
              Ver pedido #{pedido.woo_order_id} en WooCommerce →
            </a>
          )}
        </div>
      </div>

      {/* Líneas de pedido */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <h2 className="font-semibold text-gray-700 px-5 py-4 border-b border-gray-100">Productos</h2>
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="px-5 py-2 text-left">Producto</th>
              <th className="px-5 py-2 text-left">SKU</th>
              <th className="px-5 py-2 text-center">Cant.</th>
              <th className="px-5 py-2 text-right">Precio</th>
              <th className="px-5 py-2 text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {pedido.pedidos_lineas.map((l) => (
              <tr key={l.id} className="hover:bg-gray-50">
                <td className="px-5 py-3">
                  <p className="font-medium text-gray-900">{l.nombre_producto}</p>
                  {l.nombre_variacion && <p className="text-xs text-gray-400">{l.nombre_variacion}</p>}
                </td>
                <td className="px-5 py-3 text-gray-400 font-mono text-xs">{l.sku}</td>
                <td className="px-5 py-3 text-center">{l.cantidad}</td>
                <td className="px-5 py-3 text-right">{l.precio_unitario.toFixed(2)} €</td>
                <td className="px-5 py-3 text-right font-semibold">{l.subtotal.toFixed(2)} €</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Panel de gestión */}
      <div className="bg-white rounded-xl shadow p-5 space-y-4">
        <h2 className="font-semibold text-gray-700">Gestión interna</h2>

        <div className="grid md:grid-cols-3 gap-4">
          {/* Estado */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Estado del pedido</label>
            <select
              value={estado}
              onChange={(e) => setEstado(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-rose-500 focus:border-rose-500"
            >
              {ESTADOS.map((s) => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
          </div>

          {/* Coste proveedor */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Coste a depeluqueria (€)
              <span className="text-gray-400 ml-1">— lo que les pagas</span>
            </label>
            <input
              type="number"
              step="0.01"
              value={coste}
              onChange={(e) => handleCosteChange(e.target.value)}
              placeholder="0.00"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-rose-500 focus:border-rose-500"
            />
          </div>

          {/* Ganancia */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Ganancia neta (€)
              <span className="text-gray-400 ml-1">— se calcula sola</span>
            </label>
            <input
              type="number"
              step="0.01"
              value={ganancia}
              onChange={(e) => setGanancia(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-green-500 focus:border-green-500 bg-green-50"
            />
          </div>
        </div>

        {/* Notas internas */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">Notas internas (no visibles al cliente)</label>
          <textarea
            rows={3}
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder="Instrucciones para el almacén, seguimiento, etc."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-rose-500 focus:border-rose-500"
          />
        </div>

        {/* Acciones */}
        <div className="flex flex-wrap gap-3 pt-2">
          <button
            onClick={guardar}
            disabled={saving}
            className="bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-medium"
          >
            {saving ? "Guardando…" : "Guardar cambios"}
          </button>

          {!pedido.woo_order_id ? (
            <button
              onClick={lanzarWoo}
              disabled={launching}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-medium"
            >
              {launching ? "Enviando a WooCommerce…" : "📦 Lanzar pedido a depeluqueria"}
            </button>
          ) : (
            <span className="inline-flex items-center gap-1 text-sm text-green-700 bg-green-50 px-4 py-2 rounded-lg border border-green-200">
              ✓ Pedido enviado a WooCommerce #{pedido.woo_order_id}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, bold, color }: { label: string; value: string; bold?: boolean; color?: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-500">{label}</span>
      <span className={`${bold ? "font-bold" : ""} ${color ?? "text-gray-900"}`}>{value}</span>
    </div>
  );
}
