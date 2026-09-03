import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";
import * as crypto from "crypto";
import { resolverCategoriaSimple, validarCategoriaPorNombre } from "@/lib/woo-cat-resolver";

// ── Verificación de firma HMAC-SHA256 de WooCommerce ─────────────────────────
function verificarFirmaWC(body: string, signature: string, secret: string): boolean {
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(body, "utf8");
  const expected = hmac.digest("base64");
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

// ── Llamada autenticada a la API REST de WooCommerce ─────────────────────────
async function wooFetch<T>(path: string): Promise<T> {
  const base = process.env.WOO_URL!;
  const ck   = process.env.WOO_CONSUMER_KEY!;
  const cs   = process.env.WOO_CONSUMER_SECRET!;
  const url  = `${base}/wp-json/wc/v3${path}`;
  const res  = await fetch(url, {
    headers: {
      Authorization: "Basic " + Buffer.from(`${ck}:${cs}`).toString("base64"),
      "Content-Type": "application/json",
    },
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`WooCommerce API error ${res.status}: ${path}`);
  return res.json() as Promise<T>;
}

// ── Handler principal ─────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const webhookSecret = process.env.WOO_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[WC Webhook] WOO_WEBHOOK_SECRET no configurado");
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }

  // Leer cuerpo como texto para verificar firma
  const bodyText = await req.text();
  const signature = req.headers.get("x-wc-webhook-signature") ?? "";
  const topic = req.headers.get("x-wc-webhook-topic") ?? "";
  const deliveryId = req.headers.get("x-wc-webhook-delivery-id") ?? "?";

  // Verificar autenticidad
  if (!verificarFirmaWC(bodyText, signature, webhookSecret)) {
    console.warn(`[WC Webhook] Firma inválida — delivery ${deliveryId}`);
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(bodyText);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const supabase = createAdminClient();
  console.log(`[WC Webhook] Topic: ${topic} | Delivery: ${deliveryId}`);

  try {
    switch (topic) {
      // ── Producto creado o actualizado ──────────────────────────────────────
      case "product.created":
      case "product.updated": {
        await sincronizarProducto(supabase, payload, topic === "product.created");
        break;
      }

      // ── Producto eliminado ─────────────────────────────────────────────────
      case "product.deleted": {
        const wcId = String(payload.id);
        await supabase
          .from("productos_padre")
          .update({ activo: false })
          .eq("woo_id", wcId);
        break;
      }

      // ── Pedido creado / actualizado ────────────────────────────────────────
      case "order.created":
      case "order.updated": {
        // 1. Sincronizar stock (para ventas directas en WC)
        await sincronizarStockPorPedido(supabase, payload);

        // 2. Si el pedido viene de esenciadebelleza y fue pagado, marcar como pagado
        const origen = (payload.meta_data as { key: string; value: string }[] | undefined)
          ?.find((m) => m.key === "_origen_tienda")?.value;
        const esenciaPedidoId = (payload.meta_data as { key: string; value: string }[] | undefined)
          ?.find((m) => m.key === "_esencia_pedido_id")?.value;
        const wcStatus = payload.status as string;

        if (origen === "esenciadebelleza.es" && (wcStatus === "processing" || wcStatus === "completed")) {
          const pedidoId = esenciaPedidoId ?? null;
          const wcOrderId = String(payload.id);

          // Buscar pedido por ID directo o por WC order ID
          let pedido;
          if (pedidoId) {
            const { data } = await supabase.from("pedidos")
              .select("id, estado, email_cliente, direccion_envio, gastos_envio, total, tipo_precio")
              .eq("id", pedidoId).single();
            pedido = data;
          }
          if (!pedido) {
            const { data } = await supabase.from("pedidos")
              .select("id, estado, email_cliente, direccion_envio, gastos_envio, total, tipo_precio")
              .eq("stripe_payment_id", wcOrderId).single();
            pedido = data;
          }

          if (pedido && pedido.estado === "pagado") {
            console.log(`[WC Webhook] Pedido Esencia ${pedido.id} ya estaba pagado`);
          } else if (pedido) {
            await supabase.from("pedidos").update({ estado: "pagado" }).eq("id", pedido.id);
            console.log(`[WC Webhook] Pedido Esencia ${pedido.id} marcado como pagado (WC #${wcOrderId})`);

            // Enviar email de confirmación
            const dir = pedido.direccion_envio as Record<string, string>;
            const { data: lineas } = await supabase
              .from("pedidos_lineas")
              .select("nombre_producto, nombre_variacion, cantidad, precio_unitario")
              .eq("pedido_id", pedido.id);

            const { enviarNotificacionPedido } = await import("@/lib/email");
            void enviarNotificacionPedido({
              pedidoId: pedido.id, email: pedido.email_cliente,
              nombre: dir?.nombre ?? "", apellidos: dir?.apellidos ?? "",
              total: pedido.total, gastoEnvio: pedido.gastos_envio,
              metodoPago: "WooCommerce", tipoPrecio: pedido.tipo_precio,
              provincia: dir?.provincia ?? "", ciudad: dir?.ciudad ?? "",
              lineas: (lineas ?? []).map((l) => ({
                nombre: l.nombre_producto, nombre_variacion: l.nombre_variacion,
                cantidad: l.cantidad, precio: l.precio_unitario,
              })),
            });
          }
        }
        break;
      }

      default:
        console.log(`[WC Webhook] Topic no manejado: ${topic}`);
    }
  } catch (err) {
    console.error(`[WC Webhook] Error procesando ${topic}:`, err);
    // Devolvemos 200 para que WooCommerce no reintente indefinidamente
    // El error ya está logueado
  }

  // WooCommerce espera 200 para confirmar recepción
  return NextResponse.json({ ok: true });
}

// ── Sincronizar producto completo ─────────────────────────────────────────────
async function sincronizarProducto(
  supabase: ReturnType<typeof createAdminClient>,
  p: Record<string, unknown>,
  esNuevo = false
) {
  // Leer multiplicador B2B (fallback 0.75 si no está configurado)
  let b2bMult = 0.75;
  try {
    const { data: cfg } = await supabase.from("config_tienda").select("valor").eq("clave", "precio_multiplicador_b2b").single();
    if (cfg?.valor) b2bMult = parseFloat(cfg.valor) || 0.75;
  } catch { /* usar fallback */ }
  const wc_id   = String(p.id);
  const slug    = String(p.slug);
  const catBase = await resolverCategoriaSimple(
    (p.categories as { id: number; slug: string }[]) ?? []
  );
  const { categoria, subcategoria } = validarCategoriaPorNombre(String(p.name), catBase, String(p.description || p.short_description || ""));

  // Buscar o crear marca
  let marcaId: string | null = null;
  const marcaAttr = (p.attributes as { name: string; options: string[] }[] | undefined)
    ?.find((a) => a.name.toLowerCase().includes("marca"));
  if (marcaAttr?.options?.[0]) {
    const nombreMarca = marcaAttr.options[0];
    const slugMarca   = nombreMarca.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    const { data: marca } = await supabase
      .from("marcas")
      .upsert({ nombre: nombreMarca, slug: slugMarca, activa: true }, { onConflict: "slug" })
      .select("id")
      .single();
    marcaId = marca?.id ?? null;
  }

  // UPSERT producto padre por woo_id (más estable que slug)
  const { data: padre, error: errPadre } = await supabase
    .from("productos_padre")
    .upsert(
      {
        woo_id:              wc_id,
        slug,
        nombre:              String(p.name),
        categoria,
        subcategoria,
        descripcion_general: String(p.description || p.short_description || ""),
        imagen_principal_url:(p.images as { src: string }[])?.[0]?.src ?? null,
        marca_id:            marcaId,
        activo:              p.status === "publish",
      },
      { onConflict: "woo_id" }
    )
    .select("id")
    .single();

  if (errPadre || !padre) {
    console.error("[WC Webhook] Error upsert producto padre:", errPadre);
    return;
  }

  const tipo = String(p.type);

  if (tipo === "simple") {
    // Producto simple → una única variación
    const precioB2c = parseFloat(String(p.price || p.regular_price || "0"));
    await supabase.from("productos_variaciones").upsert(
      {
        producto_padre_id: padre.id,
        sku:               String(p.sku || slug),
        nombre_variacion:  "Unidad",
        precio_b2c:        precioB2c,
        precio_b2b:        parseFloat((precioB2c * b2bMult).toFixed(2)),
        precio_comparar:   p.sale_price ? parseFloat(String(p.regular_price || "0")) : null,
        imagen_url:        (p.images as { src: string }[])?.[0]?.src ?? null,
        stock:             Number(p.stock_quantity ?? 0),
        activa:            p.status === "publish",
      },
      { onConflict: "sku" }
    );

  } else if (tipo === "variable") {
    // Producto variable → obtener variaciones via API WooCommerce
    try {
      const variaciones = await wooFetch<WooVariacion[]>(
        `/products/${wc_id}/variations?per_page=100&status=publish`
      );

      for (const v of variaciones) {
        // Nombre de la variación = valores de atributos concatenados
        const nombreVariacion = v.attributes.map((a) => a.option).join(" · ") || "Unidad";
        const sku = v.sku || `${slug}-${v.id}`;
        const precioB2C = parseFloat(v.price || v.regular_price || "0");

        await supabase.from("productos_variaciones").upsert(
          {
            producto_padre_id: padre.id,
            sku,
            nombre_variacion:  nombreVariacion,
            precio_b2c:        precioB2C,
            precio_b2b:        parseFloat((precioB2C * b2bMult).toFixed(2)),
            precio_comparar:   v.sale_price ? parseFloat(v.regular_price || "0") : null,
            imagen_url:        v.image?.src ?? (p.images as { src: string }[])?.[0]?.src ?? null,
            stock:             Number(v.stock_quantity ?? 0),
            activa:            v.status === "publish",
          },
          { onConflict: "sku" }
        );
      }
      console.log(`[WC Webhook] Producto ${wc_id} (variable): ${variaciones.length} variaciones sincronizadas`);
    } catch (err) {
      console.error(`[WC Webhook] Error obteniendo variaciones del producto ${wc_id}:`, err);
    }
  }

  // Generar SEO automáticamente para productos nuevos
  if (esNuevo) {
    try {
      const { generarSeoProducto } = await import("@/lib/seo-generator");
      const marcaNombre = marcaId
        ? (await supabase.from("marcas").select("nombre").eq("id", marcaId).single()).data?.nombre ?? null
        : null;
      const seo = generarSeoProducto({
        nombre:      String(p.name),
        marca:       marcaNombre,
        categoria,
        subcategoria,
        descripcion: String(p.description || p.short_description || "") || null,
      });
      await supabase.from("productos_padre").update({
        seo_title:             seo.seo_title,
        seo_description:       seo.seo_description,
        texto_enriquecido_seo: seo.texto_enriquecido_seo,
      }).eq("id", padre.id);
      console.log(`[WC Webhook] SEO generado para nuevo producto ${wc_id}: "${seo.seo_title}"`);
    } catch (err) {
      console.error(`[WC Webhook] Error generando SEO para ${wc_id}:`, err);
    }
  }
}

// ── Tipos WooCommerce (internos al webhook) ───────────────────────────────────
interface WooVariacion {
  id: number;
  sku: string;
  price: string;
  regular_price: string;
  sale_price: string;
  stock_quantity: number | null;
  status: string;
  attributes: { name: string; option: string }[];
  image: { src: string } | null;
}

// ── Descontar stock cuando se crea un pedido en WooCommerce ──────────────────
async function sincronizarStockPorPedido(
  supabase: ReturnType<typeof createAdminClient>,
  pedido: Record<string, unknown>
) {
  const estado = String(pedido.status);
  // Solo procesar pedidos que confirman venta (no borradores ni cancelados)
  if (!["processing", "completed"].includes(estado)) return;

  const lineas = pedido.line_items as {
    sku: string;
    quantity: number;
    product_id: number;
    variation_id: number;
  }[] | undefined;

  if (!lineas?.length) return;

  for (const linea of lineas) {
    if (!linea.sku) continue;
    // Actualizar stock restando la cantidad vendida en WooCommerce
    const { data: variacion } = await supabase
      .from("productos_variaciones")
      .select("id, stock")
      .eq("sku", linea.sku)
      .single();

    if (variacion) {
      const nuevoStock = Math.max(0, (variacion.stock ?? 0) - linea.quantity);
      await supabase
        .from("productos_variaciones")
        .update({ stock: nuevoStock })
        .eq("id", variacion.id);
    }
  }
}
