import { listarPedidos, obtenerMetricas } from "@/actions/pedidos";
import Link from "next/link";
import { PedidosTable } from "./pedidos-table";

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

  // Serializar pedidos para el componente cliente
  const pedidosSerializados = pedidos.map((p: Record<string, unknown>) => ({
    id:           p.id as string,
    estado:       p.estado as string,
    total:        p.total as number,
    coste_proveedor: p.coste_proveedor as number | null,
    ganancia_neta:   p.ganancia_neta as number | null,
    email_cliente:   p.email_cliente as string,
    woo_order_id:    p.woo_order_id as number | null,
    woo_estado:      p.woo_estado as string | null,
    created_at:      p.created_at as string,
    direccion_envio: p.direccion_envio as Record<string, string> | null,
  }));

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

      {/* Tabla con selección y bulk actions */}
      <PedidosTable
        pedidos={pedidosSerializados}
        estados={ESTADOS}
        wooEstados={WOO}
        pagina={pagina}
        totalPaginas={totalPaginas}
      />
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
