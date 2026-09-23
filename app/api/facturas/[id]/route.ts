import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionFromCookie } from "@/lib/supabase/session-helper";
import { verificarAdmin } from "@/lib/admin-auth";
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

  // Solo el dueno del pedido (email de sesion verificado) o el admin
  const session = await getSessionFromCookie();
  const esDueno = !!session && session.email.toLowerCase() === String(pedido.email_cliente ?? "").toLowerCase();
  let esAdmin = false;
  if (session) {
    try { await verificarAdmin(); esAdmin = true; } catch { /* no admin */ }
  }
  if (!esDueno && !esAdmin) {
    return new NextResponse("No autorizado", { status: 401 });
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
