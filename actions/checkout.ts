"use server";

import { stripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import type { LineaCarrito } from "@/context/CarritoContext";

// ── Crear Payment Intent de Stripe ───────────────────────────────────────────
export async function crearPaymentIntent(lineas: LineaCarrito[]): Promise<{
  clientSecret: string | null;
  error: string | null;
}> {
  if (!lineas.length) return { clientSecret: null, error: "El carrito está vacío" };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Calcular total en céntimos
  // En el futuro: leer precio_multiplicador de config_tienda y aplicarlo aquí
  const totalCentimos = Math.round(
    lineas.reduce((acc, l) => acc + l.precio * l.cantidad, 0) * 100
  );

  if (totalCentimos < 50) {
    return { clientSecret: null, error: "El importe mínimo es 0,50 €" };
  }

  const paymentIntent = await stripe.paymentIntents.create({
    amount:   totalCentimos,
    currency: "eur",
    automatic_payment_methods: { enabled: true },
    metadata: {
      usuario_id:  user?.id ?? "guest",
      email:       user?.email ?? "",
      num_lineas:  String(lineas.length),
    },
  });

  return { clientSecret: paymentIntent.client_secret, error: null };
}

// ── Crear pedido en WooCommerce tras pago confirmado ─────────────────────────
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
}): Promise<{ wc_order_id: number | null; error: string | null }> {
  const {
    email, nombre, apellidos, telefono,
    direccion, ciudad, provincia, codigo_postal,
    lineas, stripe_pi_id, notas,
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
