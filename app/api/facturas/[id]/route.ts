import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { pedidoAFactura, generarHtmlFactura } from "@/lib/factura-generator";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createAdminClient();

  const { data: pedido, error } = await supabase
    .from("pedidos")
    .select("*, pedidos_lineas(*)")
    .eq("id", params.id)
    .single();

  if (error || !pedido) {
    return new NextResponse("Pedido no encontrado", { status: 404 });
  }

  // Extraer datos de facturación del JSONB direccion_envio si existe
  const dirEnvio = (pedido.direccion_envio ?? {}) as Record<string, unknown>;
  const facturacion = (dirEnvio as Record<string, unknown>).facturacion ?? null;

  const datos = pedidoAFactura({
    ...pedido,
    facturacion,
    descuento_cupon: pedido.descuento_cupon ?? 0,
  });

  datos.logoUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://esenciadebelleza.es"}/logo.svg`;

  const html = generarHtmlFactura(datos);

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}
