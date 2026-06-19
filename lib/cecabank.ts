/**
 * lib/cecabank.ts
 *
 * Integración con Cecabank TPV Virtual (pasarela de pago por tarjeta).
 * Documentación: https://pgw.ceca.es
 *
 * Flujo:
 *  1. generarCamposCeca()  → cliente hace POST a la URL del TPV
 *  2. Cecabank procesa el pago y redirige a URL_OK / URL_NOK
 *  3. verificarFirmaCeca() → confirmación del resultado en URL_OK
 */
import * as crypto from "crypto";

const CECA_GATEWAY_URL = "https://pgw.ceca.es/tpvweb/tpv/compra.action";

/** 9 dígitos numéricos únicos para Num_operacion (algunos contratos no aceptan letras) */
export function generarNumOper(): string {
  return String(Date.now()).slice(-9);
}

/** Rellena con ceros a la izquierda, igual que PHP str_pad($v, $len, '0', STR_PAD_LEFT) */
function pad(value: string, length: number): string {
  return value.padStart(length, "0");
}

function firma(partes: string[]): string {
  const clave = process.env.CECA_SECRET_KEY!;
  const raw   = clave + partes.join("");
  // PHP hash('sha256', ...) devuelve minúsculas – Cecabank es sensible al case
  return crypto.createHash("sha256").update(raw, "utf8").digest("hex");
}

// ── Generar campos para el formulario POST al TPV ─────────────────────────────
export function generarCamposCeca(params: {
  numOper:         string;
  importeCentimos: number;   // ej: 1595 para €15,95
  urlOk:           string;
  urlNok:          string;
  urlNot?:         string;   // URL de notificación server-to-server (opcional)
}): { gatewayUrl: string; campos: Record<string, string> } {
  const { numOper, importeCentimos, urlOk, urlNok } = params;
  const urlNot = params.urlNot ?? "https://esenciadebelleza.es/api/ceca/notificacion";

  // Campos de credenciales con padding obligatorio (igual que el plugin PHP oficial)
  const merchantId  = pad(process.env.CECA_MERCHANT_ID!,  9);
  const acquirerBin = pad(process.env.CECA_ACQUIRER_BIN!, 10);
  const terminalId  = pad(process.env.CECA_TERMINAL_ID!,  8);
  const importe     = String(importeCentimos);
  const tipoMoneda  = "978"; // EUR
  const exponente   = "2";
  const cifrado     = "SHA2";

  // La firma se calcula con los valores ya rellenos
  const f = firma([
    merchantId, acquirerBin, terminalId,
    numOper, importe, tipoMoneda, exponente,
    cifrado, urlOk, urlNok,
  ]);

  return {
    gatewayUrl: CECA_GATEWAY_URL,
    campos: {
      MerchantID:     merchantId,
      AcquirerBIN:    acquirerBin,
      TerminalID:     terminalId,
      URL_OK:         urlOk,
      URL_NOK:        urlNok,
      URL_NOT:        urlNot,   // Notificación server-to-server
      Firma:          f,
      Cifrado:        cifrado,
      Num_operacion:  numOper,
      Importe:        importe,
      TipoMoneda:     tipoMoneda,
      Exponente:      exponente,
      Pago_soportado: "SSL",
      Idioma:         "1",
    },
  };
}

// ── Verificar la firma que Cecabank envía en la respuesta ─────────────────────
export function verificarFirmaCeca(params: {
  merchantId:  string;
  acquirerBin: string;
  terminalId:  string;
  numOper:     string;
  importe:     string;
  tipoMoneda:  string;
  exponente:   string;
  referencia:  string;
  firmaRecibida: string;
}): boolean {
  const { merchantId, acquirerBin, terminalId, numOper, importe,
          tipoMoneda, exponente, referencia, firmaRecibida } = params;

  const expected = firma([
    pad(merchantId, 9), pad(acquirerBin, 10), pad(terminalId, 8),
    numOper, importe, tipoMoneda, exponente, referencia,
  ]);

  try {
    return crypto.timingSafeEqual(
      Buffer.from(firmaRecibida.toUpperCase()),
      Buffer.from(expected),
    );
  } catch {
    return false;
  }
}
