import { NextRequest, NextResponse } from "next/server";
import { verificarFirmaCeca } from "@/lib/cecabank";
import { confirmarPedidoCeca } from "@/actions/checkout";

/**
 * Notificación server-to-server de Cecabank.
 * Cecabank llama a esta URL tras el pago (configurable en el panel de Cecabank).
 * Debe devolver exactamente el texto "OK" para confirmar recepción.
 */
export async function POST(req: NextRequest) {
  const formData = await req.formData();

  const merchantId  = formData.get("MerchantID")    as string ?? "";
  const acquirerBin = formData.get("AcquirerBIN")   as string ?? "";
  const terminalId  = formData.get("TerminalID")    as string ?? "";
  const numOper     = formData.get("Num_operacion") as string ?? "";
  const importe     = formData.get("Importe")       as string ?? "";
  const tipoMoneda  = formData.get("TipoMoneda")    as string ?? "";
  const exponente   = formData.get("Exponente")     as string ?? "";
  const referencia  = formData.get("Referencia")    as string ?? "";
  const firma       = formData.get("Firma")         as string ?? "";

  // Verificar firma
  const valido = verificarFirmaCeca({
    merchantId, acquirerBin, terminalId,
    numOper, importe, tipoMoneda, exponente, referencia,
    firmaRecibida: firma,
  });

  if (!valido) {
    console.warn("[Cecabank Notif] Firma inválida para numOper:", numOper);
    return new NextResponse("FIRMA_INVALIDA", { status: 400 });
  }

  // Confirmar pedido y crear en WooCommerce
  const { ok, wc_order_id } = await confirmarPedidoCeca(numOper);
  if (ok) {
    console.log(`[Cecabank Notif] Pedido confirmado. numOper=${numOper} WC#${wc_order_id ?? "?"}`);
  } else {
    console.error("[Cecabank Notif] No se encontró pedido para numOper:", numOper);
  }

  // Cecabank espera el texto "OK" para dar el pago por procesado
  return new NextResponse("OK", { status: 200, headers: { "Content-Type": "text/plain" } });
}

// Cecabank a veces envía GET en URL_OK — también aceptamos GET para confirmar
export async function GET(req: NextRequest) {
  const p     = req.nextUrl.searchParams;
  const numOper    = p.get("Num_operacion") ?? "";
  const resultado  = p.get("resultado")     ?? "";    // nuestro param custom

  if (resultado === "ok" && numOper) {
    await confirmarPedidoCeca(numOper);
  }

  return new NextResponse("OK", { status: 200, headers: { "Content-Type": "text/plain" } });
}
