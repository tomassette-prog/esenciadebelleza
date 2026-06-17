import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { crearPedidoWooCommerce } from "@/actions/checkout";
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
        });

        if (error) {
          console.error("[Stripe Webhook] No se pudo crear pedido en WC:", error);
        } else {
          console.log(`[Stripe Webhook] Pedido creado en WC: #${wc_order_id}`);
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
