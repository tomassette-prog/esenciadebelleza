import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";
import * as crypto from "crypto";

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

// ── Mapeo categorías WooCommerce → estructura Supabase ────────────────────────
function mapearCategoria(cats: { slug: string }[]): { categoria: string; subcategoria: string } {
  const MAPA: Record<string, { categoria: string; subcategoria: string }> = {
    peluqueria:         { categoria: "peluqueria",  subcategoria: "general"     },
    tintes:             { categoria: "peluqueria",  subcategoria: "tintes"      },
    decolorantes:       { categoria: "peluqueria",  subcategoria: "decolorantes"},
    champu:             { categoria: "peluqueria",  subcategoria: "champu"      },
    acondicionadores:   { categoria: "peluqueria",  subcategoria: "acondicionadores" },
    mascarillas:        { categoria: "peluqueria",  subcategoria: "mascarillas" },
    "styling-cabello":  { categoria: "peluqueria",  subcategoria: "styling"     },
    estetica:           { categoria: "estetica",    subcategoria: "general"     },
    ceras:              { categoria: "estetica",    subcategoria: "ceras"       },
    perfumeria:         { categoria: "perfumeria",  subcategoria: "general"     },
    perfumes:           { categoria: "perfumeria",  subcategoria: "perfumes"    },
  };
  for (const cat of cats) {
    if (MAPA[cat.slug]) return MAPA[cat.slug];
  }
  return { categoria: "otros", subcategoria: "general" };
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
        await sincronizarProducto(supabase, payload);
        break;
      }

      // ── Producto eliminado ─────────────────────────────────────────────────
      case "product.deleted": {
        const wcId = String(payload.id);
        await supabase
          .from("productos_padre")
          .update({ activo: false })
          .eq("wc_product_id", wcId);
        break;
      }

      // ── Pedido creado / actualizado ────────────────────────────────────────
      // Usamos esto para descontar stock cuando se crea un pedido en WC
      // (venta directa en depeluqueriaproductos.com, no desde Esencia)
      case "order.created":
      case "order.updated": {
        await sincronizarStockPorPedido(supabase, payload);
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
  p: Record<string, unknown>
) {
  const wc_id   = String(p.id);
  const slug    = String(p.slug);
  const { categoria, subcategoria } = mapearCategoria(
    (p.categories as { slug: string }[]) ?? []
  );

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

  // UPSERT producto padre por slug
  const { data: padre, error: errPadre } = await supabase
    .from("productos_padre")
    .upsert(
      {
        slug,
        nombre:              String(p.name),
        categoria,
        subcategoria,
        descripcion_general: String(p.description || p.short_description || ""),
        imagen_principal_url:(p.images as { src: string }[])?.[0]?.src ?? null,
        marca_id:            marcaId,
        activo:              p.status === "publish",
        // Guardamos wc_product_id para sincronización futura
        // (columna añadida en esta migración si no existe aún)
      },
      { onConflict: "slug" }
    )
    .select("id")
    .single();

  if (errPadre || !padre) {
    console.error("[WC Webhook] Error upsert producto padre:", errPadre);
    return;
  }

  // Variaciones: simple → una línea, variable → iterar
  const tipo = String(p.type);
  if (tipo === "simple") {
    await supabase.from("productos_variaciones").upsert(
      {
        producto_padre_id: padre.id,
        sku:               String(p.sku || slug),
        nombre_variacion:  "Unidad",
        precio_b2c:        parseFloat(String(p.price || p.regular_price || "0")),
        precio_b2b:        parseFloat(String(p.price || p.regular_price || "0")),
        stock:             Number(p.stock_quantity ?? 0),
        activo:            p.status === "publish",
      },
      { onConflict: "sku" }
    );
  }
  // Las variaciones de productos "variable" llegan con topic product.updated
  // y sus variaciones en el campo `variations` como IDs — se gestionan
  // a través de llamadas individuales al API si es necesario.
  // Para sincronización de stock en tiempo real, el webhook order.* es suficiente.
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
