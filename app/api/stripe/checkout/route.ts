import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { calcularGastoEnvio } from "@/lib/envio";
import { validarYCalcular } from "@/lib/validar-pedido";
import { getSessionFromCookie } from "@/lib/supabase/session-helper";

export async function POST(req: NextRequest) {
  try {
    const { lineas, packs, datosEnvio } = await req.json();

    if (!lineas?.length && !packs?.length) {
      return NextResponse.json({ error: "Carrito vacío" }, { status: 400 });
    }

    // Validar cantidades (máx 9 unidades por producto)
    const MAX_UNIDADES = 9;
    for (const l of lineas as { nombre: string; cantidad: number }[]) {
      if (l.cantidad > MAX_UNIDADES) {
        return NextResponse.json({ error: `"${l.nombre}" tiene ${l.cantidad} unidades. El máximo es ${MAX_UNIDADES}. Para pedidos grandes, contacta con la tienda.` }, { status: 400 });
      }
    }

    const supabase    = createAdminClient();
    const sessionUser = await getSessionFromCookie();

    // Perfil B2B aprobado -> tipo de precio profesional (igual que el resto de flujos)
    let tipoPrecio: "b2c" | "b2b" = "b2c";
    if (sessionUser) {
      const { data: perfil } = await supabase
        .from("perfiles_usuario")
        .select("b2b_aprobado, tipo_cliente")
        .eq("id", sessionUser.id)
        .single();
      if (perfil?.tipo_cliente === "b2b" && perfil?.b2b_aprobado === true) tipoPrecio = "b2b";
    }

    // Precios, packs y descuento validados/recalculados contra la BD
    const packsReq = (packs ?? []) as {
      pack_id: string; nombre: string; precio: number; cantidad: number;
      imagen_url: string | null; items?: { variacion_id: string }[];
    }[];
    const calc = await validarYCalcular({ lineas, packs: packsReq, cupon: datosEnvio.cupon ?? null, tipoPrecio });
    if (!calc.ok) return NextResponse.json({ error: calc.error }, { status: 409 });

    const totalProductos = calc.subtotal;
    const descuentoCupon = calc.descuento;
    const cuponId: string | null = calc.cuponId;
    const gastoEnvio     = calcularGastoEnvio(totalProductos, datosEnvio.provincia, datosEnvio.ciudad);
    if (gastoEnvio === -1) {
      return NextResponse.json({ error: "No realizamos envíos a esa provincia." }, { status: 400 });
    }

    const totalFinal = totalProductos - descuentoCupon + gastoEnvio;
    const siteUrl    = process.env.NEXT_PUBLIC_SITE_URL ?? "https://esenciadebelleza.es";

    // Guardar pedido
    const { data: pedido } = await supabase.from("pedidos").insert({
      usuario_id:      sessionUser?.id ?? null,
      estado:          "pendiente",
      subtotal:        totalProductos,
      descuento:       descuentoCupon,
      gastos_envio:    gastoEnvio,
      total:           totalFinal,
      tipo_precio:     tipoPrecio,
      metodo_pago:     "stripe",
      email_cliente:   datosEnvio.email,
      notas:           datosEnvio.notas ?? "",
      cupon_id:        cuponId,
      descuento_cupon: descuentoCupon,
      direccion_envio: {
        nombre: datosEnvio.nombre, apellidos: datosEnvio.apellidos,
        telefono: datosEnvio.telefono, direccion: datosEnvio.direccion,
        ciudad: datosEnvio.ciudad, provincia: datosEnvio.provincia,
        codigo_postal: datosEnvio.codigo_postal,
        ...(datosEnvio.facturacion ? { facturacion: datosEnvio.facturacion } : {}),
      },
    }).select("id").single();

    if (pedido) {
      const { error: errLineas } = await supabase.from("pedidos_lineas").insert([
        ...lineas.map((l: { variacion_id: string; sku: string; nombre: string; nombre_variacion: string; imagen_url: string; precio: number; cantidad: number }) => ({
          pedido_id: pedido.id, variacion_id: l.variacion_id,
          sku: l.sku, nombre_producto: l.nombre, nombre_variacion: l.nombre_variacion,
          imagen_url: l.imagen_url, precio_unitario: l.precio,
          cantidad: l.cantidad, subtotal: l.precio * l.cantidad,
        })),
        // Packs de regalo: una linea por pack completo
        ...packsReq.map((p) => ({
          price_data: {
            currency:     "eur",
            product_data: {
              name:   `Pack de regalo — ${p.nombre}`,
              images: p.imagen_url ? [p.imagen_url] : [],
            },
            unit_amount: Math.round(p.precio * 100),
          },
          quantity: p.cantidad,
        })),
      ]);
      if (errLineas) {
        console.error("[stripe-checkout] Error guardando líneas:", errLineas);
        // Eliminar pedido huérfano
        await supabase.from("pedidos").delete().eq("id", pedido.id);
        return NextResponse.json({ error: "No se pudieron guardar los productos. Es posible que el stock se haya agotado." }, { status: 409 });
      }
    }

    // Crear sesión Stripe
    const session = await stripe.checkout.sessions.create({
      mode:                        "payment",
      locale:                      "es",
      payment_method_types:        ["card"],
      billing_address_collection:  "auto",
      line_items: [
        ...lineas.map((l: { nombre: string; nombre_variacion?: string; imagen_url?: string; precio: number; cantidad: number }) => ({
          price_data: {
            currency:     "eur",
            product_data: { name: l.nombre_variacion ? `${l.nombre} — ${l.nombre_variacion}` : l.nombre,
              images: l.imagen_url ? [l.imagen_url] : [],
            },
            unit_amount: Math.round(l.precio * 100),
          },
          quantity: l.cantidad,
        })),
        ...packsReq.map((p) => ({
          price_data: {
            currency:     "eur",
            product_data: {
              name:   `Pack de regalo — ${p.nombre}`,
              images: p.imagen_url ? [p.imagen_url] : [],
            },
            unit_amount: Math.round(p.precio * 100),
          },
          quantity: p.cantidad,
        })),
        ...(descuentoCupon > 0 ? [{
          price_data: {
            currency:     "eur",
            product_data: { name: `Cupón ${datosEnvio.cupon.codigo}` },
            unit_amount:  -Math.round(descuentoCupon * 100),
          },
          quantity: 1,
        }] : []),
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
      metadata: { pedido_id: pedido?.id ?? "", nombre_cliente: `${datosEnvio.nombre} ${datosEnvio.apellidos}`, cupon_id: cuponId ?? "", descuento_cupon: String(descuentoCupon) },
    });

    if (pedido && session.id) {
      await supabase.from("pedidos").update({ stripe_payment_id: session.id }).eq("id", pedido.id);
    }

    if (!session.url) {
      return NextResponse.json({ error: "Stripe no devolvió una URL de pago" }, { status: 500 });
    }

    return NextResponse.json({ url: session.url });

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[stripe-checkout]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
