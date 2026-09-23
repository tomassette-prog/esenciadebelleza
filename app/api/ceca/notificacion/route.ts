import { NextRequest, NextResponse } from "next/server";
import { verificarFirmaCeca } from "@/lib/cecabank";
import { confirmarPagoCecaFirmado } from "@/lib/ceca-confirmar";

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

  // Confirmar pedido con el IMPORTE FIRMADO como prueba de pago
  const importeCents = importe.includes(".")
    ? Math.round(parseFloat(importe) * 100)
    : parseInt(importe, 10);
  const { ok, motivo } = await confirmarPagoCecaFirmado(numOper, importeCents);
  if (ok) {
    console.log(`[Cecabank Notif] Pedido confirmado. numOper=${numOper}`);
  } else {
    console.error("[Cecabank Notif] Pago NO confirmado:", numOper, motivo ?? "");
  }

  // Cecabank espera el texto "OK" para dar el pago por procesado
  return new NextResponse("OK", { status: 200, headers: { "Content-Type": "text/plain" } });
}

// GET no se expone: confirmar pedidos sin firma HMAC sería inseguro
