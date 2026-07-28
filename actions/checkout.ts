"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generarNumOper, generarCamposCeca } from "@/lib/cecabank";
import { stripe } from "@/lib/stripe";
import type { LineaCarrito, LineaPack } from "@/context/CarritoContext";

import { calcularGastoEnvio } from "@/lib/envio";
import { enviarNotificacionPedido } from "@/lib/email";

// ── Convertir packs a líneas de pedido (explota cada pack en sus componentes) ─
function explotarPacks(packs: LineaPack[]): {
  lineasPedido: { pack_id: string; nombre: string; sku: string; variacion_id: string; cantidad: number; precio_unitario: number; subtotal: number; nombre_variacion: string; imagen_url: string | null }[];
  lineasWoo:    { sku: string; cantidad: number }[];
} {
  const lineasPedido: { pack_id: string; nombre: string; sku: string; variacion_id: string; cantidad: number; precio_unitario: number; subtotal: number; nombre_variacion: string; imagen_url: string | null }[] = [];
  const wooMap = new Map<string, number>();

  for (const pack of packs) {
    // Una línea por pack completo en pedidos_lineas
    lineasPedido.push({
      pack_id:          pack.pack_id,
      nombre:           pack.nombre,
      sku:              `PACK-${pack.pack_id.slice(0, 8)}`,
      variacion_id:     pack.items[0]?.variacion_id ?? "",  // referencia al primer item
      cantidad:         pack.cantidad,
      precio_unitario:  pack.precio,
      subtotal:         pack.precio * pack.cantidad,
      nombre_variacion: "Pack de regalo",
      imagen_url:       pack.imagen_url,
    });

    // Para WooCommerce: cada componente × cantidad del pack
    for (const item of pack.items) {
      const totalUnidades = item.cantidad * pack.cantidad;
      wooMap.set(item.sku, (wooMap.get(item.sku) ?? 0) + totalUnidades);
    }
  }

  const lineasWoo = [...wooMap.entries()].map(([sku, cantidad]) => ({ sku, cantidad }));
  return { lineasPedido, lineasWoo };
}

// ── Iniciar pago con Cecabank ─────────────────────────────────────────────────
export async function iniciarPagoCeca(
  lineas: LineaCarrito[],
  packs: LineaPack[],
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
  if (!lineas.length && !packs.length) return { gatewayUrl: null, campos: null, gastoEnvio: 0, error: "El carrito está vacío" };

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

  const totalProductos = lineas.reduce((acc, l) => acc + l.precio * l.cantidad, 0)
                       + packs.reduce((acc, p) => acc + p.precio * p.cantidad, 0);
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
      stripe_payment_id: numOper,
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

  // Guardar líneas de productos individuales
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

  // Guardar líneas de packs (una línea por pack completo)
  if (packs.length) {
    const { lineasPedido: packLineas } = explotarPacks(packs);
    await supabase.from("pedidos_lineas").insert(
      packLineas.map((p) => ({
        pedido_id:        pedido.id,
        variacion_id:     p.variacion_id || null,
        sku:              p.sku,
        nombre_producto:  p.nombre,
        nombre_variacion: p.nombre_variacion,
        imagen_url:       p.imagen_url,
        precio_unitario:  p.precio_unitario,
        cantidad:         p.cantidad,
        subtotal:         p.subtotal,
      }))
    );
  }

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
): Promise<{ ok: boolean; wc_order_id?: number; email?: string; pedidoId?: string }> {
  const supabase = createAdminClient();

  const { data: pedido } = await supabase
    .from("pedidos")
    .select("id, email_cliente, direccion_envio, gastos_envio, total, tipo_precio, estado")
    .eq("stripe_payment_id", numOper)
    .single();

  if (!pedido) return { ok: false };
  if (pedido.estado === "pagado") return { ok: true }; // ya procesado (idempotente)

  // Actualizar estado
  await supabase
    .from("pedidos")
    .update({ estado: "pagado" })
    .eq("stripe_payment_id", numOper);

  // Obtener líneas para email y WooCommerce
  const { data: lineas } = await supabase
    .from("pedidos_lineas")
    .select("sku, cantidad, precio_unitario, nombre_producto, nombre_variacion")
    .eq("pedido_id", pedido.id);

  const dir = pedido.direccion_envio as Record<string, string>;

  // Para WooCommerce: separar líneas normales de packs (SKU empieza con PACK-)
  const lineasNormales = (lineas ?? []).filter((l) => !l.sku.startsWith("PACK-"));
  const lineasPack     = (lineas ?? []).filter((l) => l.sku.startsWith("PACK-"));

  // Resolver componentes de packs → SKUs individuales para WooCommerce
  type WooLinea = { sku: string; cantidad: number };
  const lineasWooExtra: WooLinea[] = [];
  if (lineasPack.length) {
    // Obtener los pack_ids de las líneas de pack (SKU = PACK-{pack_id.slice(0,8)})
    // Los guardamos con variacion_id nulo y sku PACK-xxx → buscamos por sku pattern
    // Alternativa: buscar todos los packs_regalo_items cuyos pack_id aparecen
    for (const lp of lineasPack) {
      const packIdPrefix = lp.sku.replace("PACK-", "");
      const { data: packItems } = await supabase
        .from("packs_regalo")
        .select(`id, packs_regalo_items(variacion_id, cantidad, variacion:productos_variaciones(sku))`)
        .ilike("id", `${packIdPrefix}%`)
        .single();
      if (packItems) {
        // Supabase devuelve la relación como array; extraemos el primer item
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

  // Enviar notificación por email al admin
  void enviarNotificacionPedido({
    pedidoId:   pedido.id,
    email:      pedido.email_cliente,
    nombre:     dir.nombre    ?? "",
    apellidos:  dir.apellidos ?? "",
    total:      pedido.total  ?? 0,
    gastoEnvio: pedido.gastos_envio ?? 0,
    metodoPago: "Cecabank",
    tipoPrecio: pedido.tipo_precio ?? "b2c",
    provincia:  dir.provincia ?? "",
    ciudad:     dir.ciudad    ?? "",
    lineas: (lineas ?? []).map((l) => ({
      nombre:           l.nombre_producto ?? l.sku,
      nombre_variacion: l.nombre_variacion,
      cantidad:         l.cantidad,
      precio:           l.precio_unitario,
    })),
  });

  const { wc_order_id } = await crearPedidoWooCommerce({
    email:         pedido.email_cliente,
    nombre:        dir.nombre        ?? "",
    apellidos:     dir.apellidos     ?? "",
    telefono:      dir.telefono      ?? "",
    direccion:     dir.direccion     ?? "",
    ciudad:        dir.ciudad        ?? "",
    provincia:     dir.provincia     ?? "",
    codigo_postal: dir.codigo_postal ?? "",
    lineas:        todasLineasWoo as unknown as LineaCarrito[],
    ceca_num_oper: numOper,
    gasto_envio:   pedido.gastos_envio,
  });

  return { ok: true, wc_order_id: wc_order_id ?? undefined, email: pedido.email_cliente, pedidoId: pedido.id };
}

// ── Crear pedido en WooCommerce ───────────────────────────────────────────────

export async function iniciarPagoWooCommerce(
  lineas: LineaCarrito[],
  datosEnvio: {
    email: string; nombre: string; apellidos: string; telefono: string;
    direccion: string; ciudad: string; provincia: string; codigo_postal: string;
    notas?: string;
  }
): Promise<{ pagoUrl: string | null; pedidoId: string | null; gastoEnvio: number; error: string | null }> {
  if (!lineas.length) return { pagoUrl: null, pedidoId: null, gastoEnvio: 0, error: "El carrito está vacío" };

  const supabase   = createAdminClient();
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();

  let tipoPrecio: "b2c" | "b2b" = "b2c";
  if (user) {
    const { data: perfil } = await authClient
      .from("perfiles_usuario")
      .select("b2b_aprobado, tipo_cliente").eq("id", user.id).single();
    if (perfil?.tipo_cliente === "b2b" && perfil?.b2b_aprobado === true) tipoPrecio = "b2b";
  }

  const totalProductos = lineas.reduce((acc, l) => acc + l.precio * l.cantidad, 0);
  const gastoEnvio     = calcularGastoEnvio(totalProductos, datosEnvio.provincia);
  if (gastoEnvio === -1) return { pagoUrl: null, pedidoId: null, gastoEnvio: 0, error: "No realizamos envíos a esa provincia." };

  const totalFinal = totalProductos + gastoEnvio;

  // 1. Guardar pedido pendiente en Supabase
  const { data: pedido, error: errPedido } = await supabase
    .from("pedidos")
    .insert({
      usuario_id:       user?.id ?? null,
      estado:           "pendiente",
      subtotal:         totalProductos,
      gastos_envio:     gastoEnvio,
      total:            totalFinal,
      tipo_precio:      tipoPrecio,
      metodo_pago:      "woocommerce",
      email_cliente:    datosEnvio.email,
      notas:            datosEnvio.notas ?? "",
      direccion_envio:  {
        nombre: datosEnvio.nombre, apellidos: datosEnvio.apellidos,
        telefono: datosEnvio.telefono, direccion: datosEnvio.direccion,
        ciudad: datosEnvio.ciudad, provincia: datosEnvio.provincia,
        codigo_postal: datosEnvio.codigo_postal,
      },
    })
    .select("id")
    .single();

  if (errPedido || !pedido) {
    return { pagoUrl: null, pedidoId: null, gastoEnvio, error: "Error al preparar el pedido" };
  }

  // Guardar líneas
  await supabase.from("pedidos_lineas").insert(
    lineas.map((l) => ({
      pedido_id: pedido.id, variacion_id: l.variacion_id,
      sku: l.sku, nombre_producto: l.nombre, nombre_variacion: l.nombre_variacion,
      imagen_url: l.imagen_url, precio_unitario: l.precio,
      cantidad: l.cantidad, subtotal: l.precio * l.cantidad,
    }))
  );

  // 2. Crear pedido en WooCommerce como PENDING (no pagado)
  const WOO_URL = process.env.WOO_URL!;
  const CK      = process.env.WOO_CONSUMER_KEY!;
  const CS      = process.env.WOO_CONSUMER_SECRET!;
  const auth    = Buffer.from(`${CK}:${CS}`).toString("base64");
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://esenciadebelleza.es";

  const wcBody = {
    payment_method:       "",
    payment_method_title: "",
    set_paid:             false,
    status:               "pending",
    billing: {
      first_name: datosEnvio.nombre, last_name: datosEnvio.apellidos,
      address_1: datosEnvio.direccion, city: datosEnvio.ciudad,
      state: datosEnvio.provincia, postcode: datosEnvio.codigo_postal,
      country: "ES", email: datosEnvio.email, phone: datosEnvio.telefono,
    },
    shipping: {
      first_name: datosEnvio.nombre, last_name: datosEnvio.apellidos,
      address_1: datosEnvio.direccion, city: datosEnvio.ciudad,
      state: datosEnvio.provincia, postcode: datosEnvio.codigo_postal,
      country: "ES",
    },
    line_items: lineas.map((l) => ({ sku: l.sku, quantity: l.cantidad })),
    shipping_lines: gastoEnvio > 0 ? [{
      method_id: "flat_rate", method_title: "Envío estándar",
      total: gastoEnvio.toFixed(2),
    }] : [],
    meta_data: [
      { key: "_origen_tienda", value: "esenciadebelleza.es" },
      { key: "_esencia_pedido_id", value: pedido.id },
    ],
    customer_note: datosEnvio.notas ?? "",
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000); // 8s timeout for Vercel Hobby

    const res = await fetch(`${WOO_URL}/wp-json/wc/v3/orders`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
        "User-Agent": "EsenciaBelleza/1.0",
      },
      body: JSON.stringify(wcBody),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      const texto = await res.text();
      console.error("[iniciarPagoWoo] WC error:", res.status, texto);
      return { pagoUrl: null, pedidoId: pedido.id, gastoEnvio, error: `WooCommerce error ${res.status}` };
    }

    const wcOrder = await res.json() as { id: number; order_key: string };

    // Actualizar pedido en Supabase con el WC order ID
    await supabase.from("pedidos")
      .update({ stripe_payment_id: String(wcOrder.id) })
      .eq("id", pedido.id);

    // 3. URL de pago de WooCommerce (pay-for-order page)
    const pagoUrl = `${WOO_URL}/checkout/order-pay/${wcOrder.id}/?pay_for_order=true&key=${wcOrder.order_key}`;

    return { pagoUrl, pedidoId: pedido.id, gastoEnvio, error: null };
  } catch (err) {
    console.error("[iniciarPagoWoo] Excepción:", err);
    const msg = err instanceof Error && err.name === 'AbortError'
      ? "WooCommerce tardó demasiado en responder. Intentá de nuevo."
      : "No se pudo conectar con WooCommerce";
    return { pagoUrl: null, pedidoId: pedido?.id ?? null, gastoEnvio, error: msg };
  }
}
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
  packs: LineaPack[],
  datosEnvio: {
    email: string; nombre: string; apellidos: string; telefono: string;
    direccion: string; ciudad: string; provincia: string; codigo_postal: string;
    notas?: string;
  }
): Promise<{ url: string | null; error: string | null }> {
  if (!lineas.length && !packs.length) return { url: null, error: "El carrito está vacío" };

  const supabase   = createAdminClient();
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();

  const totalProductos = lineas.reduce((acc, l) => acc + l.precio * l.cantidad, 0)
                       + packs.reduce((acc, p) => acc + p.precio * p.cantidad, 0);
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const session = await (stripe.checkout.sessions.create as any)({
    mode:           "payment",
    customer_email: datosEnvio.email,
    locale:         "es",
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

// ── Confirmar pago de Stripe verificando con API ────────────────────────────
export async function confirmarPedidoStripe(
  sessionId: string
): Promise<{ ok: boolean; wc_order_id?: number; email?: string; pedidoId?: string }> {
  const supabase = createAdminClient();

  // Obtener el pedido que corresponde a esta sesión
  const { data: pedido } = await supabase
    .from("pedidos")
    .select("id, email_cliente, direccion_envio, gastos_envio, total, tipo_precio, estado")
    .eq("stripe_payment_id", sessionId)
    .single();

  if (!pedido) return { ok: false };
  if (pedido.estado === "pagado") return { ok: true, pedidoId: pedido.id, email: pedido.email_cliente }; // ya procesado (idempotente)

  // Verificar la sesión con Stripe API
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  
  if (session.payment_status !== "paid") {
    return { ok: false };
  }

  // Actualizar estado a pagado
  await supabase
    .from("pedidos")
    .update({ estado: "pagado" })
    .eq("stripe_payment_id", sessionId);

  // Obtener líneas para email y WooCommerce
  const { data: lineas } = await supabase
    .from("pedidos_lineas")
    .select("sku, cantidad, precio_unitario, nombre_producto, nombre_variacion")
    .eq("pedido_id", pedido.id);

  const dir = pedido.direccion_envio as Record<string, string>;

  // Preparar líneas para WooCommerce
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

  // Enviar notificación email al admin
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
  const { wc_order_id } = await crearPedidoWooCommerce({
    email:         pedido.email_cliente,
    nombre:        dir.nombre        ?? "",
    apellidos:     dir.apellidos     ?? "",
    telefono:      dir.telefono      ?? "",
    direccion:     dir.direccion     ?? "",
    ciudad:        dir.ciudad        ?? "",
    provincia:     dir.provincia     ?? "",
    codigo_postal: dir.codigo_postal ?? "",
    lineas:        todasLineasWoo as unknown as LineaCarrito[],
    gasto_envio:   pedido.gastos_envio,
  });

  return { ok: true, wc_order_id: wc_order_id ?? undefined, email: pedido.email_cliente, pedidoId: pedido.id };
}
