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

    // Actualizar estado a pagado
    await supabase
      .from("pedidos")
      .update({ estado: "pagado" })
      .eq("id", pedido.id);

    console.log(`[Stripe Webhook] Pedido ${pedido.id} marcado como pagado`);

    // Obtener líneas
    const { data: lineas } = await supabase
      .from("pedidos_lineas")
      .select("sku, cantidad, precio_unitario, nombre_producto, nombre_variacion")
      .eq("pedido_id", pedido.id);

    const dir = pedido.direccion_envio as Record<string, string>;

    // Separar líneas normales de packs
    const lineasNormales = (lineas ?? []).filter((l) => !l.sku.startsWith("PACK-"));
    const lineasPack     = (lineas ?? []).filter((l) => l.sku.startsWith("PACK-"));

    type WooLinea = { sku: string; cantidad: number };
    const lineasWooExtra: WooLinea[] = [];
    if (lineasPack.length) {
      for (const lp of lineasPack) {
        const packIdPrefix = lp.sku.replace("PACK-", "");
        const { data: packItems } = await supabase
          .from("packs_regalo")
          .select(`id, packs_regalo_items(variacion_id, cantidad, variacion:productos_variaciones(sku))`)
          .ilike("id", `${packIdPrefix}%`)
          .single();
        if (packItems) {
          const rows = ((packItems as unknown as { packs_regalo_items: { cantidad: number; variacion: unknown }[] }).packs_regalo_items) ?? [];
          for (const item of rows) {
            const varArr = item.variacion as { sku: string }[] | null;
            const sku = Array.isArray(varArr) ? varArr[0]?.sku : (varArr as unknown as { sku: string } | null)?.sku;
            if (sku) {
              lineasWooExtra.push({ sku, cantidad: item.cantidad * lp.cantidad });
            }
          }
        }
      }
    }

    const todasLineasWoo: WooLinea[] = [
      ...lineasNormales.map((l) => ({ sku: l.sku, cantidad: l.cantidad })),
      ...lineasWooExtra,
    ];

    // Enviar notificación email
    void enviarNotificacionPedido({
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
    });

    // Crear pedido en WooCommerce
    try {
      const { wc_order_id, error } = await crearPedidoWooCommerce({
        email:         pedido.email_cliente,
        nombre:        dir.nombre        ?? "",
        apellidos:     dir.apellidos     ?? "",
        telefono:      dir.telefono      ?? "",
        direccion:     dir.direccion     ?? "",
        ciudad:        dir.ciudad        ?? "",
        provincia:     dir.provincia     ?? "",
        codigo_postal: dir.codigo_postal ?? "",
        lineas:        todasLineasWoo as unknown as { sku: string; cantidad: number }[],
        gasto_envio:   pedido.gastos_envio,
      });

      if (error) {
        console.error("[Stripe Webhook] Error creando pedido en WC:", error);
      } else {
        console.log(`[Stripe Webhook] Pedido WooCommerce #${wc_order_id} creado para ${pedido.id}`);
      }
    } catch (err) {
      console.error("[Stripe Webhook] Excepción creando pedido WC:", err);
    }
  }

  if (event.type === "checkout.session.expired") {
    const session = event.data.object as Stripe.Checkout.Session;
    console.log(`[Stripe] Sesión expirada: ${session.id}`);
  }

  return NextResponse.json({ received: true });
}
