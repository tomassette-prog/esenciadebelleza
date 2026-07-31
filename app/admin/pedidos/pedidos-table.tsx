"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { eliminarPedidosPendientes } from "@/actions/pedidos";

interface Pedido {
  id: string;
  estado: string;
  total: number;
  coste_proveedor: number | null;
  ganancia_neta: number | null;
  email_cliente: string;
  woo_order_id: number | null;
  woo_estado: string | null;
  created_at: string;
  direccion_envio: Record<string, string> | null;
  metodo_pago: string | null;
}

interface Estilos { label: string; color: string }

export function PedidosTable({
  pedidos,
  estados,
  wooEstados,
  pagina,
  totalPaginas,
}: {
  pedidos: Pedido[];
  estados: Record<string, Estilos>;
  wooEstados: Record<string, Estilos>;
  pagina: number;
  totalPaginas: number;
}) {
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [mensaje, setMensaje] = useState<string | null>(null);

  const pendientes = pedidos.filter((p) => p.estado === "pendiente");
  const todosLosPendientesSeleccionados =
    pendientes.length > 0 && pendientes.every((p) => seleccionados.has(p.id));

  function toggleSeleccion(id: string) {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function seleccionarTodosPendientes() {
    if (todosLosPendientesSeleccionados) {
      setSeleccionados(new Set());
    } else {
      setSeleccionados(new Set(pendientes.map((p) => p.id)));
    }
  }

  function eliminarSeleccionados() {
    const ids = Array.from(seleccionados).filter((id) => {
      const p = pedidos.find((ped) => ped.id === id);
      return p?.estado === "pendiente";
    });

    if (ids.length === 0) return;

    const confirmar = window.confirm(
      `¿Eliminar ${ids.length} pedido${ids.length > 1 ? "s" : ""} pendiente${ids.length > 1 ? "s" : ""}? Esta acción no se puede deshacer.`
    );
    if (!confirmar) return;

    startTransition(async () => {
      const result = await eliminarPedidosPendientes(ids);
      if (result.error) {
        setMensaje(`❌ Error: ${result.error}`);
      } else {
        setMensaje(`✅ ${result.eliminados} pedido${result.eliminados > 1 ? "s" : ""} eliminado${result.eliminados > 1 ? "s" : ""}`);
        setSeleccionados(new Set());
      }
      setTimeout(() => setMensaje(null), 4000);
    });
  }

  const seleccionadosPendientes = Array.from(seleccionados).filter((id) => {
    const p = pedidos.find((ped) => ped.id === id);
    return p?.estado === "pendiente";
  }).length;

  return (
    <>
      {/* Barra de acciones bulk */}
      {seleccionados.size > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-center justify-between">
          <div className="text-sm text-rose-800">
            <strong>{seleccionados.size}</strong> pedido{seleccionados.size > 1 ? "s" : ""} seleccionado{seleccionados.size > 1 ? "s" : ""}
            {seleccionadosPendientes < seleccionados.size && (
              <span className="text-rose-500 ml-2">
                ({seleccionados.size - seleccionadosPendientes} no pendientes — solo se pueden eliminar pendientes)
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setSeleccionados(new Set())}
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg"
            >
              Deseleccionar
            </button>
            {seleccionadosPendientes > 0 && (
              <button
                onClick={eliminarSeleccionados}
                disabled={isPending}
                className="px-4 py-1.5 text-sm text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg font-medium"
              >
                {isPending ? "Eliminando…" : `Eliminar ${seleccionadosPendientes} pendiente${seleccionadosPendientes > 1 ? "s" : ""}`}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Mensaje de feedback */}
      {mensaje && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-800">
          {mensaje}
        </div>
      )}

      {/* Tabla */}
      <div className="bg-white rounded-xl shadow overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
            <tr>
              <th className="px-4 py-3 text-center w-10">
                <input
                  type="checkbox"
                  checked={todosLosPendientesSeleccionados}
                  onChange={seleccionarTodosPendientes}
                  disabled={pendientes.length === 0}
                  title="Seleccionar todos los pendientes"
                  className="rounded border-gray-300"
                />
              </th>
              <th className="px-4 py-3 text-left">Fecha</th>
              <th className="px-4 py-3 text-left">Cliente</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3 text-right">Coste</th>
              <th className="px-4 py-3 text-right">Ganancia</th>
              <th className="px-4 py-3 text-center">Estado</th>
              <th className="px-4 py-3 text-center">WooCommerce</th>
              <th className="px-4 py-3 text-center">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {pedidos.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-gray-400">
                  No hay pedidos todavía
                </td>
              </tr>
            )}
            {pedidos.map((p) => {
              const e = estados[p.estado] ?? estados.pendiente;
              const w = wooEstados[p.woo_estado ?? "pendiente"] ?? wooEstados.pendiente;
              const dir = p.direccion_envio ?? {};
              const isPendiente = p.estado === "pendiente";
              return (
                <tr
                  key={p.id}
                  className={`hover:bg-gray-50 ${seleccionados.has(p.id) ? "bg-rose-50" : ""}`}
                >
                  <td className="px-4 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={seleccionados.has(p.id)}
                      onChange={() => toggleSeleccion(p.id)}
                      disabled={!isPendiente}
                      title={isPendiente ? "Seleccionar" : "Solo pedidos pendientes"}
                      className="rounded border-gray-300 disabled:opacity-30"
                    />
                  </td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                    <div>{new Date(p.created_at).toLocaleDateString("es-ES", { timeZone: "Europe/Madrid" })}</div>
                    <div className="text-xs text-gray-400">
                      {new Date(p.created_at).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" })}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900 flex items-center gap-2">
                      {dir.nombre} {dir.apellidos}
                      {p.metodo_pago?.toLowerCase().includes("contrarembolso") && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                          💵 CR
                        </span>
                      )}
                    </div>
                    <div className="text-gray-400 text-xs">{p.email_cliente}</div>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">
                    {p.total.toFixed(2)} €
                  </td>
                  <td className="px-4 py-3 text-right text-red-600">
                    {p.coste_proveedor != null ? (
                      `${p.coste_proveedor.toFixed(2)} €`
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-green-600 font-semibold">
                    {p.ganancia_neta != null ? (
                      `${p.ganancia_neta.toFixed(2)} €`
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${e.color}`}>
                      {e.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {p.woo_order_id ? (
                      <a
                        href={`https://depeluqueriaproductos.com/wp-admin/post.php?post=${p.woo_order_id}&action=edit`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`px-2 py-1 rounded-full text-xs font-medium ${w.color} hover:underline`}
                      >
                        #{p.woo_order_id} {w.label}
                      </a>
                    ) : (
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${w.color}`}>
                        {w.label}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Link
                      href={`/admin/pedidos/${p.id}`}
                      className="text-rose-600 hover:text-rose-700 font-medium text-xs underline"
                    >
                      Gestionar
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      {totalPaginas > 1 && (
        <div className="flex gap-2 justify-center">
          {Array.from({ length: totalPaginas }, (_, i) => i + 1).map((n) => (
            <Link
              key={n}
              href={`?pagina=${n}`}
              className={`px-3 py-1 rounded text-sm border ${
                n === pagina
                  ? "bg-rose-600 text-white border-rose-600"
                  : "border-gray-300 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {n}
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
