import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionFromCookie } from "@/lib/supabase/session-helper";
import { verificarAdmin } from "@/lib/admin-auth";

const BUCKET = "facturas";

/**
 * GET /api/facturas/ver/[id]
 * Sirve el HTML de una factura ya generada con content-type correcto.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data: factura } = await supabase
    .from("facturas")
    .select("id, nombre, archivo_path, email_cliente, profesional_id")
    .eq("id", id)
    .single();

  if (!factura) {
    return new NextResponse("Factura no encontrada", { status: 404 });
  }

  // Solo el dueno de la factura o el admin
  const session = await getSessionFromCookie();
  const emailFactura = (factura.email_cliente ?? "").toLowerCase();
  const esDueno = !!session && (session.id === factura.profesional_id || (emailFactura !== "" && session.email.toLowerCase() === emailFactura));
  let esAdmin = false;
  if (session) {
    try { await verificarAdmin(); esAdmin = true; } catch { /* no admin */ }
  }
  if (!esDueno && !esAdmin) {
    return new NextResponse("No autorizado", { status: 401 });
  }

  const { data: file } = await supabase.storage
    .from(BUCKET)
    .download(factura.archivo_path);

  if (!file) {
    return new NextResponse("Archivo no encontrado", { status: 404 });
  }

  const html = await file.text();

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}
