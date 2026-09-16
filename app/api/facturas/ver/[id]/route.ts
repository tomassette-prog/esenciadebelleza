import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "facturas";

/**
 * GET /api/facturas/ver/[id]
 * Sirve el HTML de una factura ya generada con content-type correcto.
 */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createAdminClient();

  const { data: factura } = await supabase
    .from("facturas")
    .select("id, nombre, archivo_path")
    .eq("id", params.id)
    .single();

  if (!factura) {
    return new NextResponse("Factura no encontrada", { status: 404 });
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
