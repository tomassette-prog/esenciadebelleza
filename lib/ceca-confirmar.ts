import { createAdminClient } from "@/lib/supabase/admin";
import { registrarUsoCupon } from "@/actions/cupones";

/**
 * Confirmación de pago de Cecabank SOLO para uso del webhook firmado
 * (/api/ceca/notificacion). No es una server action: la transición a "pagado"
 * jamás debe poder invocarse desde el navegador sin prueba de pago firmada
 * por el banco.
 */
export async function confirmarPagoCecaFirmado(
  numOper: string,
  importeCents: number
): Promise<{ ok: boolean; email?: string; pedidoId?: string; motivo?: string }> {
  const supabase = createAdminClient();

  const { data: pedido } = await supabase
    .from("pedidos")
    .select("id, estado, email_cliente, total, metodo_pago, cupon_id, descuento_cupon, usuario_id")
    .eq("stripe_payment_id", numOper)
    .single();

  if (!pedido) return { ok: false, motivo: "pedido_no_encontrado" };
  if (pedido.metodo_pago !== "cecabank") return { ok: false, motivo: "metodo_inesperado" };

  // El importe firmado por el banco debe coincidir con el total del pedido
  const totalCents = Math.round(Number(pedido.total) * 100);
  if (importeCents !== totalCents) return { ok: false, motivo: "importe_no_coincide" };

  // UPDATE atómico: solo desde pendiente (idempotente ante notificaciones duplicadas)
  const { data: updated } = await supabase
    .from("pedidos")
    .update({ estado: "pagado" })
    .eq("stripe_payment_id", numOper)
    .eq("estado", "pendiente")
    .select("id");

  if (!updated || updated.length === 0) {
    // Confirmado por una notificación anterior: idempotente OK
    return pedido.estado === "pagado"
      ? { ok: true, email: pedido.email_cliente, pedidoId: pedido.id }
      : { ok: false, motivo: "estado_no_valido" };
  }

  if (pedido.cupon_id && pedido.descuento_cupon > 0) {
    await registrarUsoCupon(pedido.cupon_id, pedido.id, pedido.usuario_id, pedido.descuento_cupon);
  }

  return { ok: true, email: pedido.email_cliente, pedidoId: pedido.id };
}
