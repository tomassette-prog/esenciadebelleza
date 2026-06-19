import { listarPedidos, obtenerMetricas } from "@/actions/pedidos";
import Link from "next/link";

const ESTADOS: Record<string, { label: string; color: string }> = {
  pendiente:    { label: "Pendiente",    color: "bg-yellow-100 text-yellow-800" },
  pagado:       { label: "Pagado",       color: "bg-green-100 text-green-800" },
  preparando:   { label: "Preparando",   color: "bg-blue-100 text-blue-800" },
  enviado:      { label: "Enviado",      color: "bg-indigo-100 text-indigo-800" },
  entregado:    { label: "Entregado",    color: "bg-gray-100 text-gray-800" },
  cancelado:    { label: "Cancelado",    color: "bg-red-100 text-red-800" },
  reembolsado:  { label: "Reembolsado",  color: "bg-orange-100 text-orange-800" },
};

const WOO: Record<string, { label: string; color: string }> = {
  pendiente: { label: "No enviado", color: "bg-gray-100 text-gray-500" },
  enviado:   { label: "En Woo ✓",   color: "bg-green-100 text-green-700" },
  error:     { label: "Error",       color: "bg-red-100 text-red-700" },
};

export const metadata = { title: "Pedidos | Admin" };

export default async function AdminPedidosPage({
  searchParams,
}: {
  searchParams: Promise<{ pagina?: string }>;
}) {
  const sp = await searchParams;
  const pagina = Number(sp.pagina ?? 1);
  const [{ pedidos, total }, metricas] = await Promise.all([
    listarPedidos(pagina, 25),
    obtenerMetricas(),
  ]);

  const totalPaginas = Math.ceil(total / 25);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Gestión de Pedidos</h1>

      {/* Métricas */}
      {metricas && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard
            label="Facturado total"
            value={`${metricas.totalFacturado.toFixed(2)} €`}
            color="text-gray-900"
          />
          <MetricCard
            label="Coste proveedor"
            value={`${metricas.totalCoste.toFixed(2)} €`}
            color="text-red-600"
          />
          <MetricCard
            label="Ganancia neta"
            value={`${metricas.totalGanancia.toFixed(2)} €`}
            color="text-green-600"
          />
          <MetricCard
            label="Pedidos activos"
            value={`${metricas.pedidosPagados} / ${metricas.totalPedidos}`}
            color="text-blue-600"
          />
        </div>
      )}

      {/* Tabla */}
      <div className="bg-white rounded-xl shadow overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
            <tr>
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
                <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                  No hay pedidos todavía
                </td>
              </tr>
            )}
            {pedidos.map((p: Record<string, unknown>) => {
              const e  = ESTADOS[p.estado as string] ?? ESTADOS.pendiente;
              const w  = WOO[p.woo_estado as string] ?? WOO.pendiente;
              const dir = (p.direccion_envio as Record<string, string>) ?? {};
              return (
                <tr key={p.id as string} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                    <div>{new Date(p.created_at as string).toLocaleDateString("es-ES")}</div>
                    <div className="text-xs text-gray-400">{new Date(p.created_at as string).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{dir.nombre} {dir.apellidos}</div>
                    <div className="text-gray-400 text-xs">{p.email_cliente as string}</div>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">
                    {(p.total as number).toFixed(2)} €
                  </td>
                  <td className="px-4 py-3 text-right text-red-600">
                    {p.coste_proveedor != null ? `${(p.coste_proveedor as number).toFixed(2)} €` : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right text-green-600 font-semibold">
                    {p.ganancia_neta != null ? `${(p.ganancia_neta as number).toFixed(2)} €` : <span className="text-gray-300">—</span>}
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
                        #{p.woo_order_id as number} {w.label}
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
                n === pagina ? "bg-rose-600 text-white border-rose-600" : "border-gray-300 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {n}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-white rounded-xl shadow p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}
