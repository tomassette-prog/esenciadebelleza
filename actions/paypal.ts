"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { calcularGastoEnvio } from "@/lib/envio";
import type { LineaCarrito } from "@/context/CarritoContext";

const PAYPAL_BASE = "https://api-m.paypal.com"; // live

async function getPaypalToken(): Promise<string> {
  const clientId = process.env.PAYPAL_CLIENT_ID!;
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
  }
): Promise<{ orderId: string | null; gastoEnvio: number; error: string | null }> {
  if (!lineas.length) return { orderId: null, gastoEnvio: 0, error: "El carrito está vacío" };

  const totalProductos = lineas.reduce((acc, l) => acc + l.precio * l.cantidad, 0);
  const gastoEnvio     = calcularGastoEnvio(totalProductos, datosEnvio.provincia);
  if (gastoEnvio === -1) return { orderId: null, gastoEnvio: 0, error: "No realizamos envíos a esa provincia." };

  const totalFinal = totalProductos + gastoEnvio;

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
              },
            },
            items: lineas.map((l) => ({
              name:        l.nombre.slice(0, 127),
              unit_amount: { currency_code: "EUR", value: l.precio.toFixed(2) },
              quantity:    String(l.cantidad),
              sku:         l.sku,
            })),
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
        payment_source: {
          paypal: {
            experience_context: {
              locale:              "es-ES",
              brand_name:          "Esencia de Belleza",
              landing_page:        "LOGIN",
              user_action:         "PAY_NOW",
              return_url:          "https://esenciadebelleza.es/checkout/confirmacion?metodo=paypal&resultado=ok",
              cancel_url:          "https://esenciadebelleza.es/checkout?paypal=cancelado",
            },
          },
        },
      }),
    });

    const order = await res.json();
    if (!res.ok) {
      console.error("[PayPal] createOrder error:", order);
      return { orderId: null, gastoEnvio, error: order.message ?? "Error al crear el pago con PayPal" };
    }

    // Guardar pedido pendiente en Supabase
    const authClient = await createClient();
    const { data: { user } } = await authClient.auth.getUser();

    let tipoPrecio: "b2c" | "b2b" = "b2c";
    if (user) {
      const { data: perfil } = await authClient.from("perfiles_usuario")
        .select("b2b_aprobado, tipo_cliente").eq("id", user.id).single();
      if (perfil?.tipo_cliente === "b2b" && perfil?.b2b_aprobado === true) tipoPrecio = "b2b";
    }

    const supabase = createAdminClient();
    await supabase.from("pedidos").insert({
      usuario_id:       user?.id ?? null,
      estado:           "pendiente",
      subtotal:         totalProductos,
      gastos_envio:     gastoEnvio,
      total:            totalFinal,
      tipo_precio:      tipoPrecio,
      metodo_pago:      "paypal",
      stripe_payment_id: order.id,   // reutilizamos como payment_ref
      email_cliente:    datosEnvio.email,
      notas:            datosEnvio.notas ?? "",
      direccion_envio: {
        nombre:        datosEnvio.nombre,
        apellidos:     datosEnvio.apellidos,
        telefono:      datosEnvio.telefono,
        direccion:     datosEnvio.direccion,
        ciudad:        datosEnvio.ciudad,
        provincia:     datosEnvio.provincia,
        codigo_postal: datosEnvio.codigo_postal,
      },
    });

    await supabase.from("pedidos_lineas").insert(
      lineas.map((l) => ({
        pedido_id:        null, // Se actualiza al capturar
        variacion_id:     l.variacion_id,
        sku:              l.sku,
        nombre_producto:  l.nombre,
        nombre_variacion: l.nombre_variacion,
        cantidad:         l.cantidad,
        precio_unitario:  l.precio,
      }))
    );

    // Devolver el payer-action URL para redirigir al usuario
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
    if (!res.ok) return { ok: false, error: data.message };

    if (data.status === "COMPLETED") {
      // Actualizar estado del pedido en Supabase
      const supabase = createAdminClient();
      await supabase
        .from("pedidos")
        .update({ estado: "pagado" })
        .eq("stripe_payment_id", orderId);
      return { ok: true };
    }
    return { ok: false, error: `Estado inesperado: ${data.status}` };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}
