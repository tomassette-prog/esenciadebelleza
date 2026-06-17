"use server";

import { stripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { LineaCarrito } from "@/context/CarritoContext";

// ── Leer config de envío desde Supabase ──────────────────────────────────────
async function getConfigEnvio(): Promise<{ gratisDesde: number; coste: number }> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("config_tienda")
    .select("clave, valor")
    .in("clave", ["envio_gratis_desde", "envio_coste"]);
  const map: Record<string, string> = {};
  for (const row of data ?? []) map[row.clave] = row.valor;
  return {
    gratisDesde: parseFloat(map.envio_gratis_desde ?? "49"),
    coste:       parseFloat(map.envio_coste ?? "4.95"),
  };
}

// ── Crear Payment Intent de Stripe ───────────────────────────────────────────
export async function crearPaymentIntent(lineas: LineaCarrito[]): Promise<{
  clientSecret: string | null;
  error: string | null;
  gastoEnvio: number;
}> {
  if (!lineas.length) return { clientSecret: null, error: "El carrito está vacío", gastoEnvio: 0 };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { gratisDesde, coste } = await getConfigEnvio();
  const totalProductos = lineas.reduce((acc, l) => acc + l.precio * l.cantidad, 0);
  const gastoEnvio = totalProductos >= gratisDesde ? 0 : coste;
  const totalFinal = totalProductos + gastoEnvio;

  const totalCentimos = Math.round(totalFinal * 100);

  if (totalCentimos < 50) {
    return { clientSecret: null, error: "El importe mínimo es 0,50 €", gastoEnvio: 0 };
  }

  const paymentIntent = await stripe.paymentIntents.create({
    amount:   totalCentimos,
    currency: "eur",
    automatic_payment_methods: { enabled: true },
    metadata: {
      usuario_id:   user?.id ?? "guest",
      email:        user?.email ?? "",
      num_lineas:   String(lineas.length),
      gasto_envio:  String(gastoEnvio),
      total_productos: String(totalProductos.toFixed(2)),
    },
  });

  return { clientSecret: paymentIntent.client_secret, error: null, gastoEnvio };
}

// ── Actualizar metadatos del Payment Intent con datos del pedido ─────────────
export async function actualizarMetadataPI(
  paymentIntentId: string,
  checkoutData: {
    email: string; nombre: string; apellidos: string; telefono: string;
    direccion: string; ciudad: string; provincia: string; codigo_postal: string;
    notas?: string;
    lineas: Array<{ sku: string; cantidad: number; precio: number }>;
    gasto_envio: number;
  }
): Promise<{ ok: boolean; error?: string }> {
  try {
    await stripe.paymentIntents.update(paymentIntentId, {
      metadata: {
        checkout_data: JSON.stringify(checkoutData),
        gasto_envio: String(checkoutData.gasto_envio),
      },
    });
    return { ok: true };
  } catch (err) {
    console.error("[actualizarMetadataPI]", err);
    return { ok: false, error: "No se pudieron guardar los datos del pedido" };
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
  lineas:         LineaCarrito[];
  stripe_pi_id:   string;
  notas?:         string;
  gasto_envio?:   number;
}): Promise<{ wc_order_id: number | null; error: string | null }> {
  const {
    email, nombre, apellidos, telefono,
    direccion, ciudad, provincia, codigo_postal,
    lineas, stripe_pi_id, notas, gasto_envio = 0,
  } = params;

  const WOO_URL = process.env.WOO_URL!;
  const CK      = process.env.WOO_CONSUMER_KEY!;
  const CS      = process.env.WOO_CONSUMER_SECRET!;

  const auth = Buffer.from(`${CK}:${CS}`).toString("base64");

  const body = {
    payment_method:       "stripe",
    payment_method_title: "Tarjeta de crédito / débito",
    set_paid:             true,
    status:               "processing",
    billing: {
      first_name: nombre,
      last_name:  apellidos,
      address_1:  direccion,
      city:       ciudad,
      state:      provincia,
      postcode:   codigo_postal,
      country:    "ES",
      email,
      phone:      telefono,
    },
    shipping: {
      first_name: nombre,
      last_name:  apellidos,
      address_1:  direccion,
      city:       ciudad,
      state:      provincia,
      postcode:   codigo_postal,
      country:    "ES",
    },
    line_items: lineas.map((l) => ({
      sku:      l.sku,
      quantity: l.cantidad,
    })),
    shipping_lines: gasto_envio > 0 ? [
      {
        method_id:    "flat_rate",
        method_title: "Envío estándar",
        total:        gasto_envio.toFixed(2),
      },
    ] : [],
    meta_data: [
      { key: "_stripe_payment_intent", value: stripe_pi_id },
      { key: "_origen_tienda",         value: "esenciadebelleza.es" },
    ],
    customer_note: notas ?? "",
  };

  try {
    const res = await fetch(`${WOO_URL}/wp-json/wc/v3/orders`, {
      method:  "POST",
      headers: {
        Authorization:  `Basic ${auth}`,
        "Content-Type": "application/json",
        "User-Agent":   "EsenciaBelleza/1.0",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const texto = await res.text();
      console.error("[WC Order] Error al crear pedido:", res.status, texto);
      return { wc_order_id: null, error: `WooCommerce error ${res.status}` };
    }

    const data = await res.json() as { id: number };
    return { wc_order_id: data.id, error: null };
  } catch (err) {
    console.error("[WC Order] Excepción:", err);
    return { wc_order_id: null, error: "No se pudo conectar con WooCommerce" };
  }
}
