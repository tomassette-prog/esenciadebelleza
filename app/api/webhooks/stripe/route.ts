import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { enviarNotificacionPedido, enviarConfirmacionCliente } from "@/lib/email";
import { createAdminClient } from "@/lib/supabase/admin";
import Stripe from "stripe";

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: "Webhook secret no configurado" }, { status: 500 });
  }

  const body      = await req.text();
  const signature = req.headers.get("stripe-signature") ?? "";

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error("[Stripe Webhook] Firma inválida:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // ── Sesión de checkout completada ───────────────────────────────────────
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    console.log(`[Stripe] Sesión completada: ${session.id} — ${session.amount_total ? (session.amount_total / 100).toFixed(2) : 0} EUR`);

    if (session.payment_status !== "paid") {
      console.log(`[Stripe] Sesión ${session.id} no está pagada (status: ${session.payment_status})`);
      return NextResponse.json({ received: true });
    }

    const supabase = createAdminClient();
    
    // Obtener el pedido
    const { data: pedido } = await supabase
      .from("pedidos")
      .select("id, email_cliente, direccion_envio, gastos_envio, total, tipo_precio, estado")
      .eq("stripe_payment_id", session.id)
      .single();

    if (!pedido) {
      console.warn(`[Stripe Webhook] Pedido no encontrado para sesión ${session.id}`);
      return NextResponse.json({ received: true });
    }

    if (pedido.estado === "pagado") {
      console.log(`[Stripe Webhook] Pedido ${pedido.id} ya está marcado como pagado`);
      return NextResponse.json({ received: true });
    }

    // UPDATE atómico: solo actualiza si sigue pendiente (evita race condition y devuelve error trazable)
    const { error: errUpdate, data: updatedRows } = await supabase
      .from("pedidos")
      .update({ estado: "pagado" })
      .eq("id", pedido.id)
      .eq("estado", "pendiente")
      .select("id");

    if (errUpdate) {
      console.error(`[Stripe Webhook] Error marcando pagado ${pedido.id}:`, errUpdate);
      return NextResponse.json({ error: "db_error" }, { status: 500 }); // Stripe reintenta
    }
    if (!updatedRows || updatedRows.length === 0) {
      console.log(`[Stripe Webhook] Pedido ${pedido.id} ya estaba pagado (concurrente)`);
      return NextResponse.json({ received: true });
    }

    console.log(`[Stripe Webhook] Pedido ${pedido.id} marcado como pagado`);

    // Obtener líneas
    const { data: lineas } = await supabase
      .from("pedidos_lineas")
      .select("sku, cantidad, precio_unitario, nombre_producto, nombre_variacion")
      .eq("pedido_id", pedido.id);

    const dir = pedido.direccion_envio as Record<string, string>;

    // Enviar notificación al admin y confirmación al cliente
    const emailPayload = {
      pedidoId:   pedido.id,
      email:      pedido.email_cliente,
      nombre:     dir.nombre    ?? "",
      apellidos:  dir.apellidos ?? "",
      total:      pedido.total,
      gastoEnvio: pedido.gastos_envio,
      metodoPago: "Stripe",
      tipoPrecio: pedido.tipo_precio,
      provincia:  dir.provincia ?? "",
      ciudad:     dir.ciudad    ?? "",
      lineas: (lineas ?? []).map((l) => ({
        nombre:           l.nombre_producto,
        nombre_variacion: l.nombre_variacion,
        cantidad:         l.cantidad,
        precio:           l.precio_unitario,
      })),
    };
    await enviarNotificacionPedido(emailPayload);
    await enviarConfirmacionCliente(emailPayload);
  }

  if (event.type === "checkout.session.expired") {
    const session = event.data.object as Stripe.Checkout.Session;
    console.log(`[Stripe] Sesión expirada: ${session.id}`);

    // Marcar pedido como cancelado si sigue pendiente
    const supabase = createAdminClient();
    const { data: pedido } = await supabase
      .from("pedidos")
      .select("id, estado")
      .eq("stripe_payment_id", session.id)
      .single();

    if (pedido && pedido.estado === "pendiente") {
      await supabase
        .from("pedidos")
        .update({ estado: "cancelado", notas: "Checkout expirado — cliente no completó el pago" })
        .eq("id", pedido.id);
      console.log(`[Stripe] Pedido ${pedido.id} cancelado por sesión expirada`);
    }
  }

  return NextResponse.json({ received: true });
}
