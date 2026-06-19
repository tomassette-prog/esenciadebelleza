import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { calcularGastoEnvio } from "@/lib/envio";

export async function POST(req: NextRequest) {
  try {
    const { lineas, datosEnvio } = await req.json();

    if (!lineas?.length) {
      return NextResponse.json({ error: "Carrito vacío" }, { status: 400 });
    }

    const supabase   = createAdminClient();
    const authClient = await createClient();
    const { data: { user } } = await authClient.auth.getUser();

    const totalProductos = lineas.reduce((acc: number, l: { precio: number; cantidad: number }) => acc + l.precio * l.cantidad, 0);
    const gastoEnvio     = calcularGastoEnvio(totalProductos, datosEnvio.provincia);
    if (gastoEnvio === -1) {
      return NextResponse.json({ error: "No realizamos envíos a esa provincia." }, { status: 400 });
    }
    const totalFinal = totalProductos + gastoEnvio;
    const siteUrl    = process.env.NEXT_PUBLIC_SITE_URL ?? "https://esenciadebelleza.es";

    // Guardar pedido
    const { data: pedido } = await supabase.from("pedidos").insert({
      usuario_id:      user?.id ?? null,
      estado:          "pendiente",
      subtotal:        totalProductos,
      gastos_envio:    gastoEnvio,
      total:           totalFinal,
      tipo_precio:     "b2c",
      metodo_pago:     "stripe",
      email_cliente:   datosEnvio.email,
      notas:           datosEnvio.notas ?? "",
      direccion_envio: {
        nombre: datosEnvio.nombre, apellidos: datosEnvio.apellidos,
        telefono: datosEnvio.telefono, direccion: datosEnvio.direccion,
        ciudad: datosEnvio.ciudad, provincia: datosEnvio.provincia,
        codigo_postal: datosEnvio.codigo_postal,
      },
    }).select("id").single();

    if (pedido) {
      await supabase.from("pedidos_lineas").insert(
        lineas.map((l: { variacion_id: string; sku: string; nombre: string; nombre_variacion: string; imagen_url: string; precio: number; cantidad: number }) => ({
          pedido_id: pedido.id, variacion_id: l.variacion_id,
          sku: l.sku, nombre_producto: l.nombre, nombre_variacion: l.nombre_variacion,
          imagen_url: l.imagen_url, precio_unitario: l.precio,
          cantidad: l.cantidad, subtotal: l.precio * l.cantidad,
        }))
      );
    }

    // Crear sesión Stripe (cast para compatibilidad con versión del SDK)
    const session = await (stripe.checkout.sessions.create as (p: object) => Promise<{ id: string; url: string }>)({
      mode:           "payment",
      customer_email: datosEnvio.email,
      locale:         "es",
      automatic_payment_methods: { enabled: true },
      billing_address_collection: "auto",
      line_items: [
        ...lineas.map((l: { nombre: string; nombre_variacion?: string; imagen_url?: string; precio: number; cantidad: number }) => ({
          price_data: {
            currency:     "eur",
            product_data: {
              name:   l.nombre_variacion ? `${l.nombre} — ${l.nombre_variacion}` : l.nombre,
              images: l.imagen_url ? [l.imagen_url] : [],
            },
            unit_amount: Math.round(l.precio * 100),
          },
          quantity: l.cantidad,
        })),
        ...(gastoEnvio > 0 ? [{
          price_data: {
            currency: "eur",
            product_data: { name: "Gastos de envío" },
            unit_amount: Math.round(gastoEnvio * 100),
          },
          quantity: 1,
        }] : []),
      ],
      success_url: `${siteUrl}/checkout/confirmacion?session_id={CHECKOUT_SESSION_ID}&resultado=ok`,
      cancel_url:  `${siteUrl}/checkout`,
      metadata: { pedido_id: pedido?.id ?? "", nombre_cliente: `${datosEnvio.nombre} ${datosEnvio.apellidos}` },
    });

    if (pedido && session.id) {
      await supabase.from("pedidos").update({ stripe_payment_id: session.id }).eq("id", pedido.id);
    }

    // Devolver la URL para que el cliente redirija
    return NextResponse.json({ url: session.url });

  } catch (e) {
    console.error("[stripe-checkout]", e);
    return NextResponse.json({ error: "Error al crear la sesión de pago" }, { status: 500 });
  }
}
