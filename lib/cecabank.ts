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

/** 9 caracteres alfanuméricos únicos para Num_operacion */
export function generarNumOper(): string {
  return crypto.randomUUID().replace(/-/g, "").substring(0, 9).toUpperCase();
}

function firma(partes: string[]): string {
  const clave = process.env.CECA_SECRET_KEY!;
  const raw   = clave + partes.join("");
  return crypto.createHash("sha256").update(raw, "utf8").digest("hex").toUpperCase();
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

  const merchantId  = process.env.CECA_MERCHANT_ID!;
  const acquirerBin = process.env.CECA_ACQUIRER_BIN!;
  const terminalId  = process.env.CECA_TERMINAL_ID!;
  const importe     = String(importeCentimos);
  const tipoMoneda  = "978"; // EUR
  const exponente   = "2";
  const cifrado     = "SHA2";

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
    merchantId, acquirerBin, terminalId,
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
