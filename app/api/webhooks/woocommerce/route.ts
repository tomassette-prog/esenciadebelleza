import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";
import * as crypto from "crypto";
import { WOO_CAT_MAP } from "@/lib/categorias";

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
function mapearCategoria(cats: { id: number; slug: string }[]): { categoria: string; subcategoria: string } {
  // Primero intentar por ID numérico (más preciso)
  for (const cat of cats) {
    if (WOO_CAT_MAP[cat.id]) return WOO_CAT_MAP[cat.id];
  }
  // Fallback por slug
  const SLUG_MAP: Record<string, { categoria: string; subcategoria: string }> = {
    peluqueria:        { categoria: "peluqueria",  subcategoria: "peluqueria-general" },
    tintes:            { categoria: "peluqueria",  subcategoria: "tintes"      },
    decolorantes:      { categoria: "peluqueria",  subcategoria: "decoloracion"},
    champu:            { categoria: "peluqueria",  subcategoria: "champus"     },
    acondicionadores:  { categoria: "peluqueria",  subcategoria: "acondicionadores" },
    mascarillas:       { categoria: "peluqueria",  subcategoria: "mascarillas" },
    estetica:          { categoria: "estetica",    subcategoria: "estetica-general"  },
    perfumeria:        { categoria: "perfumeria",  subcategoria: "perfumeria-general"},
    barberia:          { categoria: "barberia",    subcategoria: "barberia-general"  },
    maquillaje:        { categoria: "maquillaje",  subcategoria: "maquillaje-general"},
  };
  for (const cat of cats) {
    if (SLUG_MAP[cat.slug]) return SLUG_MAP[cat.slug];
  }
  return { categoria: "otros", subcategoria: "general" };
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
    (p.categories as { id: number; slug: string }[]) ?? []
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

  // UPSERT producto padre por wc_product_id (más estable que slug)
  const { data: padre, error: errPadre } = await supabase
    .from("productos_padre")
    .upsert(
      {
        wc_product_id:       wc_id,
        slug,
        nombre:              String(p.name),
        categoria,
        subcategoria,
        descripcion_general: String(p.description || p.short_description || ""),
        imagen_principal_url:(p.images as { src: string }[])?.[0]?.src ?? null,
        marca_id:            marcaId,
        activo:              p.status === "publish",
      },
      { onConflict: "wc_product_id" }
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
    await supabase.from("productos_variaciones").upsert(
      {
        producto_padre_id: padre.id,
        sku:               String(p.sku || slug),
        nombre_variacion:  "Unidad",
        precio_b2c:        parseFloat(String(p.price || p.regular_price || "0")),
        precio_b2b:        parseFloat(String(p.price || p.regular_price || "0")),
        precio_comparar:   p.sale_price ? parseFloat(String(p.regular_price || "0")) : null,
        imagen_url:        (p.images as { src: string }[])?.[0]?.src ?? null,
        stock:             Number(p.stock_quantity ?? 0),
        activo:            p.status === "publish",
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
            precio_b2b:        precioB2C,
            precio_comparar:   v.sale_price ? parseFloat(v.regular_price || "0") : null,
            imagen_url:        v.image?.src ?? (p.images as { src: string }[])?.[0]?.src ?? null,
            stock:             Number(v.stock_quantity ?? 0),
            activo:            v.status === "publish",
          },
          { onConflict: "sku" }
        );
      }
      console.log(`[WC Webhook] Producto ${wc_id} (variable): ${variaciones.length} variaciones sincronizadas`);
    } catch (err) {
      console.error(`[WC Webhook] Error obteniendo variaciones del producto ${wc_id}:`, err);
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
