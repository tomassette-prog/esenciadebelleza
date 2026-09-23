"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { calcularGastoEnvio } from "@/lib/envio";
import { validarYCalcular } from "@/lib/validar-pedido";
import { getSessionFromCookie } from "@/lib/supabase/session-helper";
import type { LineaCarrito, LineaPack } from "@/context/CarritoContext";

const PAYPAL_BASE = "https://api-m.paypal.com"; // live

async function getPaypalToken(): Promise<string> {
  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID!;
  const secret   = process.env.PAYPAL_SECRET_KEY!;

  const res = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${secret}`).toString("base64")}`,
    },
    body: "grant_type=client_credentials",
  });
  const data = await res.json();
  return data.access_token as string;
}

// ── Crear orden PayPal ────────────────────────────────────────────────────────
export async function crearOrdenPaypal(
  lineas: LineaCarrito[],
  datosEnvio: {
    email: string; nombre: string; apellidos: string; telefono: string;
    direccion: string; ciudad: string; provincia: string; codigo_postal: string;
    notas?: string;
    facturacion?: {
      empresa: string; nif_cif: string; direccion: string;
      ciudad: string; provincia: string; codigo_postal: string;
    } | null;
    cupon?: { id: string; codigo: string; descuento: number } | null;
  },
  packs: LineaPack[] = []
): Promise<{ orderId: string | null; gastoEnvio: number; error: string | null }> {
  if (!lineas.length) return { orderId: null, gastoEnvio: 0, error: "El carrito está vacío" };

  const MAX_UNIDADES = 9;
  for (const l of lineas) {
    if (l.cantidad > MAX_UNIDADES) return { orderId: null, gastoEnvio: 0, error: `"${l.nombre}" tiene ${l.cantidad} unidades. El máximo es ${MAX_UNIDADES}. Para pedidos grandes, contacta con la tienda.` };
  }

  // Deteccion temprana de sesion y tipo de precio (JWT verificado)
  const sessionUser = await getSessionFromCookie();
  let tipoPrecio: "b2c" | "b2b" = "b2c";
  if (sessionUser) {
    const perfilClient = createAdminClient();
    const { data: perfil } = await perfilClient
      .from("perfiles_usuario")
      .select("b2b_aprobado, tipo_cliente")
      .eq("id", sessionUser.id)
      .single();
    if (perfil?.tipo_cliente === "b2b" && perfil?.b2b_aprobado === true) tipoPrecio = "b2b";
  }

  // Precios, packs y descuento validados/recalculados contra la BD
  const calc = await validarYCalcular({ lineas, packs, cupon: datosEnvio.cupon ?? null, tipoPrecio });
  if (!calc.ok) return { orderId: null, gastoEnvio: 0, error: calc.error };

  const totalProductos = calc.subtotal;
  const descuentoCupon = calc.descuento;
  const cuponId: string | null = calc.cuponId;
  const gastoEnvio     = calcularGastoEnvio(totalProductos, datosEnvio.provincia, datosEnvio.ciudad);
  if (gastoEnvio === -1) return { orderId: null, gastoEnvio: 0, error: "No realizamos envíos a esa provincia." };

  const totalFinal = totalProductos - descuentoCupon + gastoEnvio;

  try {
    const token = await getPaypalToken();

    const res = await fetch(`${PAYPAL_BASE}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            amount: {
              currency_code: "EUR",
              value: totalFinal.toFixed(2),
              breakdown: {
                item_total:    { currency_code: "EUR", value: totalProductos.toFixed(2) },
                shipping:      { currency_code: "EUR", value: gastoEnvio.toFixed(2) },
                ...(descuentoCupon > 0 ? { discount: { currency_code: "EUR", value: descuentoCupon.toFixed(2) } } : {}),
              },
            },
            items: [
              ...lineas.map((l) => ({
                name:        l.nombre.slice(0, 127),
                unit_amount: { currency_code: "EUR", value: l.precio.toFixed(2) },
                quantity:    String(l.cantidad),
                sku:         l.sku,
              })),
              ...packs.map((p) => ({
                name:        `Pack de regalo — ${p.nombre}`.slice(0, 127),
                unit_amount: { currency_code: "EUR", value: p.precio.toFixed(2) },
                quantity:    String(p.cantidad),
                sku:         `PACK-${p.pack_id.slice(0, 8)}`,
              })),
            ],
            shipping: {
              name: { full_name: `${datosEnvio.nombre} ${datosEnvio.apellidos}` },
              address: {
                address_line_1: datosEnvio.direccion,
                admin_area_2:   datosEnvio.ciudad,
                admin_area_1:   datosEnvio.provincia,
                postal_code:    datosEnvio.codigo_postal,
                country_code:   "ES",
              },
            },
          },
        ],
        // Sin payment_source forzado → el SDK gestiona Apple Pay / Google Pay / PayPal en el frontend
      }),
    });

    const order = await res.json();
    if (!res.ok) {
      console.error("[PayPal] createOrder error:", order);
      return { orderId: null, gastoEnvio, error: order.message ?? "Error al crear el pago con PayPal" };
    }

    // Guardar pedido pendiente en Supabase
    const supabase = createAdminClient();
    const { data: pedido, error: pedidoErr } = await supabase.from("pedidos").insert({
      usuario_id:       sessionUser?.id ?? null,
      estado:           "pendiente",
      subtotal:         totalProductos,
      descuento:        descuentoCupon,
      gastos_envio:     gastoEnvio,
      total:            totalFinal,
      tipo_precio:      tipoPrecio,
      metodo_pago:      "paypal",
      stripe_payment_id: order.id,   // reutilizamos como payment_ref
      email_cliente:    datosEnvio.email,
      notas:            datosEnvio.notas ?? "",
      cupon_id:         cuponId,
      descuento_cupon:  descuentoCupon,
      direccion_envio: {
        nombre:        datosEnvio.nombre,
        apellidos:     datosEnvio.apellidos,
        telefono:      datosEnvio.telefono,
        direccion:     datosEnvio.direccion,
        ciudad:        datosEnvio.ciudad,
        provincia:     datosEnvio.provincia,
        codigo_postal: datosEnvio.codigo_postal,
      },
    }).select("id").single();

    if (pedido && !pedidoErr) {
      const { error: errLineasPaypal } = await supabase.from("pedidos_lineas").insert([
        ...lineas.map((l) => ({
          pedido_id:        pedido.id,
          variacion_id:     l.variacion_id,
          sku:              l.sku,
          nombre_producto:  l.nombre,
          nombre_variacion: l.nombre_variacion,
          cantidad:         l.cantidad,
          precio_unitario:  l.precio,
          subtotal:         l.precio * l.cantidad,
        })),
        // Packs de regalo: una linea por pack completo
        ...packs.map((p) => ({
          pedido_id:        pedido.id,
          variacion_id:     (p.items?.[0]?.variacion_id) || null,
          sku:              `PACK-${p.pack_id.slice(0, 8)}`,
          nombre_producto:  p.nombre,
          nombre_variacion: "Pack de regalo",
          imagen_url:       p.imagen_url ?? null,
          cantidad:         p.cantidad,
          precio_unitario:  p.precio,
          subtotal:         p.precio * p.cantidad,
        })),
      ]);
      if (errLineasPaypal) {
        console.error("[paypal] Error guardando líneas:", errLineasPaypal);
        await supabase.from("pedidos").delete().eq("id", pedido.id);
        return { orderId: null, gastoEnvio, error: "No se pudieron guardar los productos. Es posible que el stock se haya agotado." };
      }
    }

    // Devolver el order.id para que el SDK de PayPal lo gestione en el frontend
    const approveLink = order.links?.find((l: { rel: string; href: string }) => l.rel === "payer-action")?.href;
    return { orderId: approveLink ?? order.id, gastoEnvio, error: null };

  } catch (err) {
    console.error("[PayPal] error:", err);
    return { orderId: null, gastoEnvio, error: "Error de conexión con PayPal" };
  }
}

// ── Capturar pago (webhook/confirmación) ─────────────────────────────────────
export async function capturarPagoPaypal(
  orderId: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const token = await getPaypalToken();
    const res = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${orderId}/capture`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
    const data = await res.json();

    // Recargar la página de confirmación re-ejecuta la captura y PayPal responde
    // ORDER_ALREADY_CAPTURED: el pago YA se hizo, eso no es un error
    // (si no, mostramos "pago no confirmado" tras cobrar e invitamos a pagar otra vez)
    const yaCapturado =
      !res.ok &&
      (data?.details?.[0]?.issue === "ORDER_ALREADY_CAPTURED" || data?.name === "ORDER_ALREADY_CAPTURED");
    if (!res.ok && !yaCapturado) return { ok: false, error: data.message };

    if (data.status === "COMPLETED" || yaCapturado) {
      // Transición atómica única pendiente -> pagado; quien la gana envía emails
      const supabase = createAdminClient();
      const { data: actualizados } = await supabase
        .from("pedidos")
        .update({ estado: "pagado" })
        .eq("stripe_payment_id", orderId)
        .eq("estado", "pendiente")
        .select("id, email_cliente, direccion_envio, gastos_envio, total, tipo_precio, cupon_id, descuento_cupon, usuario_id");

      const pedido = actualizados?.[0] ?? null;

      // Sin transición: otro flujo lo confirmó antes (recarga de la página) o
      // el pedido ya no existe — solo es éxito si quedó pagado
      if (!pedido) {
        const { data: existente } = await supabase
          .from("pedidos")
          .select("id, estado")
          .eq("stripe_payment_id", orderId)
          .maybeSingle();
        if (existente?.estado === "pagado") return { ok: true };
        return { ok: false, error: "Pago recibido pero no se pudo confirmar el pedido. Contacta con la tienda." };
      }

      // Nuestra transición ganadora: emails + cupón, solo esta vez
      const { data: lineas } = await supabase
        .from("pedidos_lineas")
        .select("sku, cantidad, precio_unitario, nombre_producto, nombre_variacion")
        .eq("pedido_id", pedido.id);

      const dir = pedido.direccion_envio as Record<string, string>;

      const { enviarNotificacionPedido, enviarConfirmacionCliente } = await import("@/lib/email");
      const emailPayloadPP = {
        pedidoId:   pedido.id,
        email:      pedido.email_cliente,
        nombre:     dir?.nombre    ?? "",
        apellidos:  dir?.apellidos ?? "",
        total:      pedido.total,
        gastoEnvio: pedido.gastos_envio,
        descuento:  pedido.descuento_cupon ?? 0,
        metodoPago: "PayPal",
        tipoPrecio: pedido.tipo_precio,
        provincia:  dir?.provincia ?? "",
        ciudad:     dir?.ciudad    ?? "",
        lineas: (lineas ?? []).map((l) => ({
          nombre:           l.nombre_producto,
          nombre_variacion: l.nombre_variacion,
          cantidad:         l.cantidad,
          precio:           l.precio_unitario,
        })),
      };
      await enviarNotificacionPedido(emailPayloadPP);
      await enviarConfirmacionCliente(emailPayloadPP);

      // Registrar uso de cupón si aplica
      if (pedido.cupon_id && pedido.descuento_cupon > 0) {
        const { registrarUsoCupon } = await import("@/actions/cupones");
        await registrarUsoCupon(pedido.cupon_id, pedido.id, pedido.usuario_id, pedido.descuento_cupon);
      }

      // WooCommerce se lanza manualmente desde el panel de administración
      return { ok: true };
    }
    return { ok: false, error: `Estado inesperado: ${data.status}` };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}
