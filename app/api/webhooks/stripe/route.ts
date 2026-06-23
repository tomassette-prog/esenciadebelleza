import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { crearPedidoWooCommerce } from "@/actions/checkout";
import { enviarNotificacionPedido } from "@/lib/email";
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

  if (event.type === "payment_intent.succeeded") {
    const pi = event.data.object as Stripe.PaymentIntent;
    console.log(`[Stripe] Pago confirmado: ${pi.id} — ${(pi.amount / 100).toFixed(2)} EUR`);

    // Los datos del pedido se guardan en los metadatos del Payment Intent
    // que el cliente envía al confirmar (ver CheckoutForm)
    const meta = pi.metadata ?? {};

    if (meta.checkout_data) {
      try {
        const datos = JSON.parse(meta.checkout_data);
        const { wc_order_id, error } = await crearPedidoWooCommerce({
          ...datos,
          stripe_pi_id: pi.id,
          gasto_envio: parseFloat(meta.gasto_envio ?? "0"),
        });

        if (error) {
          console.error("[Stripe Webhook] No se pudo crear pedido en WC:", error);
        } else {
          console.log(`[Stripe Webhook] Pedido creado en WC: #${wc_order_id}`);
        }

        // Enviar notificación email al admin
        const supabase = createAdminClient();
        const { data: pedido } = await supabase
          .from("pedidos")
          .select("id, email_cliente, total, gastos_envio, tipo_precio, direccion_envio")
          .eq("stripe_payment_id", pi.id)
          .maybeSingle();

        if (pedido) {
          const { data: lineas } = await supabase
            .from("pedidos_lineas")
            .select("nombre_producto, nombre_variacion, cantidad, precio_unitario")
            .eq("pedido_id", pedido.id);

          const dir = (pedido.direccion_envio ?? {}) as Record<string, string>;
          void enviarNotificacionPedido({
            pedidoId:   pedido.id,
            email:      pedido.email_cliente ?? datos.email,
            nombre:     dir.nombre    ?? datos.nombre    ?? "",
            apellidos:  dir.apellidos ?? datos.apellidos ?? "",
            total:      pedido.total  ?? parseFloat(meta.total ?? "0"),
            gastoEnvio: pedido.gastos_envio ?? parseFloat(meta.gasto_envio ?? "0"),
            metodoPago: "Stripe",
            tipoPrecio: pedido.tipo_precio ?? "b2c",
            provincia:  dir.provincia ?? datos.provincia ?? "",
            ciudad:     dir.ciudad    ?? datos.ciudad    ?? "",
            lineas: (lineas ?? []).map((l) => ({
              nombre:           l.nombre_producto,
              nombre_variacion: l.nombre_variacion,
              cantidad:         l.cantidad,
              precio:           l.precio_unitario,
            })),
          });
        }
      } catch (err) {
        console.error("[Stripe Webhook] Error parseando checkout_data:", err);
      }
    }
  }

  if (event.type === "payment_intent.payment_failed") {
    const pi = event.data.object as Stripe.PaymentIntent;
    console.warn(`[Stripe] Pago fallido: ${pi.id}`);
  }

  return NextResponse.json({ received: true });
}
