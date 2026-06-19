import { obtenerPedido } from "@/actions/pedidos";
import DetallePedidoClient from "@/components/admin/DetallePedidoClient";
import { notFound } from "next/navigation";

export const metadata = { title: "Detalle Pedido | Admin" };

export default async function DetallePedidoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { pedido, error } = await obtenerPedido(id);

  if (error || !pedido) notFound();

  return <DetallePedidoClient pedido={pedido} />;
}
