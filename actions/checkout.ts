"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generarNumOper, generarCamposCeca } from "@/lib/cecabank";
import { stripe } from "@/lib/stripe";
import type { LineaCarrito } from "@/context/CarritoContext";

import { calcularGastoEnvio } from "@/lib/envio";

// ── Iniciar pago con Cecabank ─────────────────────────────────────────────────
export async function iniciarPagoCeca(
  lineas: LineaCarrito[],
  datosEnvio: {
    email: string; nombre: string; apellidos: string; telefono: string;
    direccion: string; ciudad: string; provincia: string; codigo_postal: string;
    notas?: string;
  }
): Promise<{
  gatewayUrl: string | null;
  campos:     Record<string, string> | null;
  gastoEnvio: number;
  error:      string | null;
}> {
  if (!lineas.length) return { gatewayUrl: null, campos: null, gastoEnvio: 0, error: "El carrito está vacío" };

  const supabase   = createAdminClient();
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();

  // Detectar si el usuario es profesional B2B aprobado
  let tipoPrecio: "b2c" | "b2b" = "b2c";
  if (user) {
    const { data: perfil } = await authClient
      .from("perfiles_usuario")
      .select("b2b_aprobado, tipo_cliente")
      .eq("id", user.id)
      .single();
    if (perfil?.tipo_cliente === "b2b" && perfil?.b2b_aprobado === true) {
      tipoPrecio = "b2b";
    }
  }

  const totalProductos = lineas.reduce((acc, l) => acc + l.precio * l.cantidad, 0);
  const gastoEnvio     = calcularGastoEnvio(totalProductos, datosEnvio.provincia);

  if (gastoEnvio === -1) {
    return { gatewayUrl: null, campos: null, gastoEnvio: 0, error: "Lo sentimos, no realizamos envíos a esa provincia." };
  }

  const totalFinal = totalProductos + gastoEnvio;

  const numOper = generarNumOper();

  // Guardar pedido pendiente en Supabase
  const { data: pedido, error: errPedido } = await supabase
    .from("pedidos")
    .insert({
      usuario_id:       user?.id ?? null,
      estado:           "pendiente",
      subtotal:         totalProductos,
      gastos_envio:     gastoEnvio,
      total:            totalFinal,
      tipo_precio:      tipoPrecio,
      metodo_pago:      "cecabank",
      stripe_payment_id: numOper,          // reutilizamos campo como payment_ref
      email_cliente:    datosEnvio.email,
      notas:            datosEnvio.notas ?? "",
      direccion_envio:  {
        nombre:        datosEnvio.nombre,
        apellidos:     datosEnvio.apellidos,
        telefono:      datosEnvio.telefono,
        direccion:     datosEnvio.direccion,
        ciudad:        datosEnvio.ciudad,
        provincia:     datosEnvio.provincia,
        codigo_postal: datosEnvio.codigo_postal,
      },
    })
    .select("id")
    .single();

  if (errPedido || !pedido) {
    console.error("[iniciarPagoCeca] Error guardando pedido:", errPedido);
    return { gatewayUrl: null, campos: null, gastoEnvio, error: "Error al preparar el pedido" };
  }

  // Guardar líneas del pedido
  await supabase.from("pedidos_lineas").insert(
    lineas.map((l) => ({
      pedido_id:        pedido.id,
      variacion_id:     l.variacion_id,
      sku:              l.sku,
      nombre_producto:  l.nombre,
      nombre_variacion: l.nombre_variacion,
      imagen_url:       l.imagen_url,
      precio_unitario:  l.precio,
      cantidad:         l.cantidad,
      subtotal:         l.precio * l.cantidad,
    }))
  );

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://esenciadebelleza.es";
  const { gatewayUrl, campos } = generarCamposCeca({
    numOper,
    importeCentimos: Math.round(totalFinal * 100),
    urlOk:  `${siteUrl}/checkout/confirmacion?num_oper=${numOper}&resultado=ok`,
    urlNok: `${siteUrl}/checkout/confirmacion?num_oper=${numOper}&resultado=ko`,
  });

  return { gatewayUrl, campos, gastoEnvio, error: null };
}

// ── Marcar pedido como pagado y crear en WooCommerce ─────────────────────────
export async function confirmarPedidoCeca(
  numOper: string
): Promise<{ ok: boolean; wc_order_id?: number }> {
  const supabase = createAdminClient();

  const { data: pedido } = await supabase
    .from("pedidos")
    .select("id, email_cliente, direccion_envio, gastos_envio, estado")
    .eq("stripe_payment_id", numOper)
    .single();

  if (!pedido) return { ok: false };
  if (pedido.estado === "pagado") return { ok: true }; // ya procesado (idempotente)

  // Actualizar estado
  await supabase
    .from("pedidos")
    .update({ estado: "pagado" })
    .eq("stripe_payment_id", numOper);

  // Obtener líneas para crear pedido en WooCommerce
  const { data: lineas } = await supabase
    .from("pedidos_lineas")
    .select("sku, cantidad, precio_unitario")
    .eq("pedido_id", pedido.id);

  const dir = pedido.direccion_envio as Record<string, string>;
  const { wc_order_id } = await crearPedidoWooCommerce({
    email:         pedido.email_cliente,
    nombre:        dir.nombre        ?? "",
    apellidos:     dir.apellidos     ?? "",
    telefono:      dir.telefono      ?? "",
    direccion:     dir.direccion     ?? "",
    ciudad:        dir.ciudad        ?? "",
    provincia:     dir.provincia     ?? "",
    codigo_postal: dir.codigo_postal ?? "",
    lineas:        (lineas ?? []) as unknown as LineaCarrito[],
    ceca_num_oper: numOper,
    gasto_envio:   pedido.gastos_envio,
  });

  return { ok: true, wc_order_id: wc_order_id ?? undefined };
}

// ── Crear pedido en WooCommerce ───────────────────────────────────────────────
export async function crearPedidoWooCommerce(params: {
  email:          string;
  nombre:         string;
  apellidos:      string;
  telefono:       string;
  direccion:      string;
  ciudad:         string;
  provincia:      string;
  codigo_postal:  string;
  lineas:         { sku: string; cantidad: number }[];
  ceca_num_oper?: string;
  notas?:         string;
  gasto_envio?:   number;
}): Promise<{ wc_order_id: number | null; error: string | null }> {
  const {
    email, nombre, apellidos, telefono,
    direccion, ciudad, provincia, codigo_postal,
    lineas, ceca_num_oper, notas, gasto_envio = 0,
  } = params;

  const WOO_URL = process.env.WOO_URL!;
  const CK      = process.env.WOO_CONSUMER_KEY!;
  const CS      = process.env.WOO_CONSUMER_SECRET!;
  const auth    = Buffer.from(`${CK}:${CS}`).toString("base64");

  const body = {
    payment_method:       "cecabank_gateway",
    payment_method_title: "Tarjeta",
    set_paid:             true,
    status:               "processing",
    billing: {
      first_name: nombre, last_name: apellidos,
      address_1: direccion, city: ciudad,
      state: provincia, postcode: codigo_postal,
      country: "ES", email, phone: telefono,
    },
    shipping: {
      first_name: nombre, last_name: apellidos,
      address_1: direccion, city: ciudad,
      state: provincia, postcode: codigo_postal,
      country: "ES",
    },
    line_items: lineas.map((l) => ({ sku: l.sku, quantity: l.cantidad })),
    shipping_lines: gasto_envio > 0 ? [{
      method_id: "flat_rate", method_title: "Envío estándar",
      total: gasto_envio.toFixed(2),
    }] : [],
    meta_data: [
      { key: "_ceca_num_operacion", value: ceca_num_oper ?? "" },
      { key: "_origen_tienda",      value: "esenciadebelleza.es" },
    ],
    customer_note: notas ?? "",
  };

  try {
    const res = await fetch(`${WOO_URL}/wp-json/wc/v3/orders`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
        "User-Agent": "EsenciaBelleza/1.0",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const texto = await res.text();
      console.error("[WC Order] Error:", res.status, texto);
      return { wc_order_id: null, error: `WooCommerce error ${res.status}` };
    }
    const data = await res.json() as { id: number };
    return { wc_order_id: data.id, error: null };
  } catch (err) {
    console.error("[WC Order] Excepción:", err);
    return { wc_order_id: null, error: "No se pudo conectar con WooCommerce" };
  }
}

// ── Iniciar pago con Stripe Checkout ─────────────────────────────────────────
export async function iniciarPagoStripe(
  lineas: LineaCarrito[],
  datosEnvio: {
    email: string; nombre: string; apellidos: string; telefono: string;
    direccion: string; ciudad: string; provincia: string; codigo_postal: string;
    notas?: string;
  }
): Promise<{ url: string | null; error: string | null }> {
  if (!lineas.length) return { url: null, error: "El carrito está vacío" };

  const supabase   = createAdminClient();
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();

  const totalProductos = lineas.reduce((acc, l) => acc + l.precio * l.cantidad, 0);
  const gastoEnvio     = calcularGastoEnvio(totalProductos, datosEnvio.provincia);
  if (gastoEnvio === -1) return { url: null, error: "No realizamos envíos a esa provincia." };

  const totalFinal = totalProductos + gastoEnvio;
  const siteUrl    = process.env.NEXT_PUBLIC_SITE_URL ?? "https://esenciadebelleza.es";

  // Guardar pedido pendiente
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
      lineas.map((l) => ({
        pedido_id: pedido.id, variacion_id: l.variacion_id,
        sku: l.sku, nombre_producto: l.nombre, nombre_variacion: l.nombre_variacion,
        imagen_url: l.imagen_url, precio_unitario: l.precio,
        cantidad: l.cantidad, subtotal: l.precio * l.cantidad,
      }))
    );
  }

  // Crear sesión de Stripe Checkout con todos los métodos disponibles en España
  const session = await stripe.checkout.sessions.create({
    mode:           "payment",
    customer_email: datosEnvio.email,
    locale:         "es",
    // Stripe muestra automáticamente todos los métodos habilitados en tu cuenta:
    // Tarjeta, Apple Pay, Google Pay, PayPal, Klarna, Link, etc.
    automatic_payment_methods: { enabled: true },
    billing_address_collection: "auto",
    line_items: [
      ...lineas.map((l) => ({
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
          currency:     "eur",
          product_data: { name: "Gastos de envío" },
          unit_amount:  Math.round(gastoEnvio * 100),
        },
        quantity: 1,
      }] : []),
    ],
    success_url: `${siteUrl}/checkout/confirmacion?session_id={CHECKOUT_SESSION_ID}&resultado=ok`,
    cancel_url:  `${siteUrl}/checkout`,
    metadata: {
      pedido_id:     pedido?.id ?? "",
      nombre_cliente: `${datosEnvio.nombre} ${datosEnvio.apellidos}`,
    },
  });

  // Guardar el ID de sesión de Stripe en el pedido
  if (pedido && session.id) {
    await supabase.from("pedidos").update({ stripe_payment_id: session.id }).eq("id", pedido.id);
  }

  return { url: session.url, error: null };
}
