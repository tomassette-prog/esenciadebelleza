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
  stripe_payment_id?: string;
  email_cliente: string;
  direccion_envio: Record<string, string>;
  created_at: string;
  tipo_precio: string;
  pedidos_lineas: Linea[];
}

export default function DetallePedidoClient({ pedido }: { pedido: Pedido }) {
  const router = useRouter();
  const dir = pedido.direccion_envio ?? {};

  const [coste, setCoste]       = useState(pedido.coste_proveedor?.toString() ?? "");
  const [ganancia, setGanancia] = useState(pedido.ganancia_neta?.toString() ?? "");
  const [notas, setNotas]       = useState(pedido.notas_internas ?? "");
  const [estado, setEstado]     = useState(pedido.estado);
  const [saving, setSaving]     = useState(false);
  const [msg, setMsg]           = useState<{ type: "ok" | "error"; text: string } | null>(null);

  // Modal de confirmación de lanzado
  const [showModal, setShowModal]       = useState(false);
  const [notasProveedor, setNotasProveedor] = useState("");
  const [launching, setLaunching]       = useState(false);

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

  async function confirmarLanzado() {
    setLaunching(true);
    setMsg(null);
    const r = await lanzarPedidoWoo(pedido.id, { notas_proveedor: notasProveedor });
    setLaunching(false);
    setShowModal(false);
    if (r.error) {
      setMsg({ type: "error", text: r.error });
    } else {
      setMsg({ type: "ok", text: `✓ Pedido #${r.wooId} creado en depeluqueriaproductos.com` });
      router.refresh();
    }
  }

  const refPago = (pedido.stripe_payment_id ?? pedido.id).toString().slice(0, 20).toUpperCase();

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
        {/* Datos del cliente */}
        <div className="bg-white rounded-xl shadow p-5 space-y-1">
          <h2 className="font-semibold text-gray-700 mb-3">Cliente y dirección de entrega</h2>
          <p className="text-gray-900 font-medium">{dir.nombre} {dir.apellidos}</p>
          <p className="text-gray-600">{dir.direccion}</p>
          <p className="text-gray-600">{dir.codigo_postal} {dir.ciudad} ({dir.provincia})</p>
          <p className="text-gray-500 text-sm">{dir.telefono}</p>
          <p className="text-gray-500 text-sm">{pedido.email_cliente}</p>
          <hr className="my-2"/>
          <p className="text-xs text-gray-400">Ref. pago: <span className="font-mono text-gray-600">{refPago}</span></p>
          <p className="text-xs text-gray-400">Método: <span className="text-gray-600">{pedido.metodo_pago ?? "—"}</span></p>
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
        <h2 className="font-semibold text-gray-700 px-5 py-4 border-b border-gray-100">Productos del pedido</h2>
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="px-5 py-2 text-left">Producto</th>
              <th className="px-5 py-2 text-left">SKU</th>
              <th className="px-5 py-2 text-center">Cant.</th>
              <th className="px-5 py-2 text-right">Precio u.</th>
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
                <td className="px-5 py-3 text-center font-semibold">{l.cantidad}</td>
                <td className="px-5 py-3 text-right">{l.precio_unitario.toFixed(2)} €</td>
                <td className="px-5 py-3 text-right font-semibold">{l.subtotal.toFixed(2)} €</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-gray-50">
            {pedido.gastos_envio > 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-2 text-right text-sm text-gray-500">Gastos de envío</td>
                <td className="px-5 py-2 text-right text-sm">{pedido.gastos_envio.toFixed(2)} €</td>
              </tr>
            )}
            <tr>
              <td colSpan={4} className="px-5 py-2 text-right font-bold text-gray-900">TOTAL</td>
              <td className="px-5 py-2 text-right font-bold text-gray-900">{pedido.total.toFixed(2)} €</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Panel de gestión */}
      <div className="bg-white rounded-xl shadow p-5 space-y-4">
        <h2 className="font-semibold text-gray-700">Gestión interna</h2>
        <div className="grid md:grid-cols-3 gap-4">
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
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Coste a depeluqueria (€) <span className="text-gray-400">— lo que les pagas</span>
            </label>
            <input
              type="number" step="0.01" value={coste}
              onChange={(e) => handleCosteChange(e.target.value)}
              placeholder="0.00"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-rose-500 focus:border-rose-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Ganancia neta (€) <span className="text-gray-400">— se calcula sola</span>
            </label>
            <input
              type="number" step="0.01" value={ganancia}
              onChange={(e) => setGanancia(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-green-500 focus:border-green-500 bg-green-50"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Notas internas (no visibles al cliente)</label>
          <textarea
            rows={2} value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder="Instrucciones internas, seguimiento, etc."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-rose-500 focus:border-rose-500"
          />
        </div>

        <div className="flex flex-wrap gap-3 pt-2">
          <button
            onClick={guardar} disabled={saving}
            className="bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-medium"
          >
            {saving ? "Guardando…" : "Guardar cambios"}
          </button>

          {!pedido.woo_order_id ? (
            <button
              onClick={() => setShowModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-sm font-medium"
            >
              📦 Lanzar pedido a depeluqueria
            </button>
          ) : (
            <span className="inline-flex items-center gap-1 text-sm text-green-700 bg-green-50 px-4 py-2 rounded-lg border border-green-200">
              ✓ Enviado a WooCommerce #{pedido.woo_order_id}
              {pedido.woo_enviado_at && (
                <span className="text-xs text-green-500 ml-1">
                  · {new Date(pedido.woo_enviado_at).toLocaleString("es-ES")}
                </span>
              )}
            </span>
          )}
        </div>
      </div>

      {/* ── Modal de confirmación de lanzado ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-5 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">Confirmar envío a depeluqueriaproductos.com</h2>
              <p className="text-sm text-gray-500 mt-1">Revisa los datos antes de crear el pedido en WooCommerce</p>
            </div>

            <div className="px-6 py-5 space-y-5">
              {/* Referencia de pago */}
              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1">Referencia de pago</p>
                <p className="font-mono text-blue-900 font-bold">{refPago}</p>
                <p className="text-xs text-blue-600 mt-1">Método: {pedido.metodo_pago ?? "—"} · Pagado: {pedido.total.toFixed(2)} €</p>
              </div>

              {/* Datos del cliente */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Datos del cliente</p>
                <div className="bg-gray-50 rounded-lg p-4 text-sm space-y-1">
                  <p><span className="text-gray-500">Nombre:</span> <strong>{dir.nombre} {dir.apellidos}</strong></p>
                  <p><span className="text-gray-500">Email:</span> {pedido.email_cliente}</p>
                  <p><span className="text-gray-500">Teléfono:</span> {dir.telefono ?? "—"}</p>
                </div>
              </div>

              {/* Dirección de entrega */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Dirección de entrega y facturación</p>
                <div className="bg-gray-50 rounded-lg p-4 text-sm space-y-1">
                  <p>{dir.direccion}</p>
                  <p>{dir.codigo_postal} {dir.ciudad} ({dir.provincia}) · España</p>
                </div>
              </div>

              {/* Productos */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Productos a pedir</p>
                <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 text-sm">
                  {pedido.pedidos_lineas.map((l) => (
                    <div key={l.id} className="px-4 py-3 flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-gray-900">{l.nombre_producto}</p>
                        {l.nombre_variacion && <p className="text-xs text-gray-400">{l.nombre_variacion}</p>}
                        <p className="text-xs text-gray-400 font-mono">SKU: {l.sku}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-semibold text-gray-900">x{l.cantidad}</p>
                        <p className="text-xs text-gray-500">{l.subtotal.toFixed(2)} €</p>
                      </div>
                    </div>
                  ))}
                  {pedido.gastos_envio > 0 && (
                    <div className="px-4 py-2 flex justify-between text-xs text-gray-500">
                      <span>Gastos de envío</span>
                      <span>{pedido.gastos_envio.toFixed(2)} €</span>
                    </div>
                  )}
                  <div className="px-4 py-2 flex justify-between font-bold text-gray-900 bg-gray-50">
                    <span>Total pedido cliente</span>
                    <span>{pedido.total.toFixed(2)} €</span>
                  </div>
                </div>
              </div>

              {/* Notas para proveedor */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Notas para el almacén (opcional)
                </label>
                <textarea
                  rows={2}
                  value={notasProveedor}
                  onChange={(e) => setNotasProveedor(e.target.value)}
                  placeholder="Ej: urgente, embalaje especial, etc."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarLanzado}
                disabled={launching}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-2 rounded-lg text-sm font-semibold"
              >
                {launching ? "Creando pedido…" : "✓ Confirmar y lanzar pedido"}
              </button>
            </div>
          </div>
        </div>
      )}
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
