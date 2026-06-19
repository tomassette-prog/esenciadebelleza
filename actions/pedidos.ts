"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

// ── Listar pedidos con métricas ──────────────────────────────────────────────
export async function listarPedidos(pagina = 1, porPagina = 20) {
  const supabase = createAdminClient();
  const desde = (pagina - 1) * porPagina;

  const { data, error, count } = await supabase
    .from("pedidos")
    .select(`
      id, estado, total, subtotal, gastos_envio,
      coste_proveedor, ganancia_neta, notas_internas,
      woo_order_id, woo_estado, woo_enviado_at,
      metodo_pago, email_cliente, direccion_envio,
      created_at, tipo_precio,
      pedidos_lineas ( id, nombre_producto, nombre_variacion, sku, cantidad, precio_unitario, subtotal )
    `, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(desde, desde + porPagina - 1);

  if (error) return { pedidos: [], total: 0, error: error.message };
  return { pedidos: data ?? [], total: count ?? 0, error: null };
}

// ── Detalle de un pedido ──────────────────────────────────────────────────────
export async function obtenerPedido(id: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("pedidos")
    .select(`
      *,
      pedidos_lineas ( * )
    `)
    .eq("id", id)
    .single();

  if (error) return { pedido: null, error: error.message };
  return { pedido: data, error: null };
}

// ── Actualizar coste/ganancia y notas internas ────────────────────────────────
export async function actualizarComision(
  id: string,
  datos: { coste_proveedor?: number; ganancia_neta?: number; notas_internas?: string }
) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("pedidos")
    .update(datos)
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/admin/pedidos");
  revalidatePath(`/admin/pedidos/${id}`);
  return { error: null };
}

// ── Actualizar estado del pedido ──────────────────────────────────────────────
export async function actualizarEstadoPedido(id: string, estado: string) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("pedidos")
    .update({ estado })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/admin/pedidos");
  revalidatePath(`/admin/pedidos/${id}`);
  return { error: null };
}

// ── Lanzar pedido a WooCommerce (depeluqueriaproductos.com) ───────────────────
export async function lanzarPedidoWoo(
  id: string,
  extra?: { notas_proveedor?: string }
) {
  const supabase = createAdminClient();

  // Obtener pedido con líneas
  const { data: pedido, error: errGet } = await supabase
    .from("pedidos")
    .select("*, pedidos_lineas(*)")
    .eq("id", id)
    .single();

  if (errGet || !pedido) return { error: "Pedido no encontrado" };
  if (pedido.woo_order_id) return { error: "Este pedido ya fue enviado a WooCommerce" };

  const wooUrl = process.env.WOO_URL!;
  const wooToken = "eb_secret_esencia_2026";

  const dir = pedido.direccion_envio as Record<string, string>;
  const refPago = (pedido.stripe_payment_id ?? pedido.id).toString().slice(0, 20).toUpperCase();

  // Nota clara para el almacén de depeluqueriaproductos
  const notaCliente = [
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `PEDIDO DESDE ESENCIA DE BELLEZA`,
    `Ref. pago: ${refPago}`,
    `Método pago: ${(pedido.metodo_pago ?? "—").toUpperCase()}`,
    ``,
    `CLIENTE:`,
    `  ${dir.nombre ?? ""} ${dir.apellidos ?? ""}`,
    `  ${pedido.email_cliente}`,
    `  Tel: ${dir.telefono ?? "—"}`,
    ``,
    `ENTREGA EN:`,
    `  ${dir.direccion ?? ""}`,
    `  ${dir.codigo_postal ?? ""} ${dir.ciudad ?? ""} (${dir.provincia ?? ""})`,
    ``,
    `PRODUCTOS:`,
    ...(pedido.pedidos_lineas as Array<{
      sku: string; nombre_producto: string; nombre_variacion?: string; cantidad: number;
    }>).map((l) =>
      `  [${l.sku}] ${l.nombre_producto}${l.nombre_variacion ? ` - ${l.nombre_variacion}` : ""} x${l.cantidad}`
    ),
    ``,
    extra?.notas_proveedor ? `NOTAS: ${extra.notas_proveedor}` : "",
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
  ].filter((l) => l !== undefined).join("\n");

  type LineaT = {
    sku: string; nombre_producto: string; nombre_variacion?: string;
    cantidad: number; precio_unitario: number; subtotal: number;
  };

  const body = {
    status:        "processing",
    currency:      "EUR",
    set_paid:      true,              // el cliente ya pagó en esenciadebelleza.es
    customer_note: notaCliente,
    payment_method:       "esencia_belleza",
    payment_method_title: `Esencia de Belleza · Ref: ${refPago}`,
    billing: {
      first_name: dir.nombre      ?? "",
      last_name:  dir.apellidos   ?? "",
      email:      pedido.email_cliente,
      phone:      dir.telefono    ?? "",
      address_1:  dir.direccion   ?? "",
      city:       dir.ciudad      ?? "",
      state:      dir.provincia   ?? "",
      postcode:   dir.codigo_postal ?? "",
      country:    "ES",
    },
    shipping: {
      first_name: dir.nombre      ?? "",
      last_name:  dir.apellidos   ?? "",
      phone:      dir.telefono    ?? "",
      address_1:  dir.direccion   ?? "",
      city:       dir.ciudad      ?? "",
      state:      dir.provincia   ?? "",
      postcode:   dir.codigo_postal ?? "",
      country:    "ES",
    },
    line_items: (pedido.pedidos_lineas as LineaT[]).map((l) => ({
      name:     l.nombre_variacion
                  ? `${l.nombre_producto} — ${l.nombre_variacion}`
                  : l.nombre_producto,
      sku:      l.sku,
      quantity: l.cantidad,
      subtotal: l.subtotal.toFixed(2),
      total:    l.subtotal.toFixed(2),
    })),
    shipping_lines: pedido.gastos_envio > 0 ? [{
      method_id:    "flat_rate",
      method_title: "Envío estándar",
      total:        pedido.gastos_envio.toFixed(2),
    }] : [],
    meta_data: [
      { key: "_origen",             value: "esenciadebelleza.es" },
      { key: "_eb_pedido_id",       value: pedido.id },
      { key: "_eb_referencia_pago", value: refPago },
      { key: "_eb_metodo_pago",     value: pedido.metodo_pago ?? "" },
      { key: "_eb_total_cliente",   value: pedido.total.toFixed(2) },
    ],
  };

  try {
    const res = await fetch(`${wooUrl}/wp-json/esencia/v1/order`, {
      method:  "POST",
      headers: {
        "Content-Type":    "application/json",
        "X-Esencia-Token": wooToken,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const txt = await res.text();
      return { error: `WooCommerce respondió ${res.status}: ${txt.slice(0, 300)}` };
    }

    const woo = await res.json();

    await supabase.from("pedidos").update({
      woo_order_id:   woo.id,
      woo_estado:     "enviado",
      woo_enviado_at: new Date().toISOString(),
    }).eq("id", id);

    revalidatePath("/admin/pedidos");
    revalidatePath(`/admin/pedidos/${id}`);
    return { wooId: woo.id as number, error: null };

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    await supabase.from("pedidos").update({ woo_estado: "error" }).eq("id", id);
    return { error: msg };
  }
}

// ── Métricas globales de comisiones ──────────────────────────────────────────
export async function obtenerMetricas() {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("pedidos")
    .select("total, coste_proveedor, ganancia_neta, estado, created_at")
    .neq("estado", "cancelado");

  if (error || !data) return null;

  const totalFacturado  = data.reduce((a, p) => a + (p.total ?? 0), 0);
  const totalCoste      = data.reduce((a, p) => a + (p.coste_proveedor ?? 0), 0);
  const totalGanancia   = data.reduce((a, p) => a + (p.ganancia_neta ?? 0), 0);
  const pedidosPagados  = data.filter((p) => p.estado === "pagado" || p.estado === "enviado" || p.estado === "entregado").length;

  return { totalFacturado, totalCoste, totalGanancia, pedidosPagados, totalPedidos: data.length };
}
