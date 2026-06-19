import { NextResponse } from "next/server";
import { generarCamposCeca, generarNumOper } from "@/lib/cecabank";

// Solo accesible en dev o si se pasa ?key=debug
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get("key") !== process.env.DEBUG_KEY && process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const numOper = generarNumOper();
  const base = process.env.NEXT_PUBLIC_URL ?? "https://esenciadebelleza.es";

  const { gatewayUrl, campos } = generarCamposCeca({
    numOper,
    importeCentimos: 100, // 1€ de prueba
    urlOk:  `${base}/checkout/confirmacion?estado=ok`,
    urlNok: `${base}/checkout/confirmacion?estado=error`,
  });

  // Ocultar el secret key pero mostrar todo lo demás
  return NextResponse.json({
    gatewayUrl,
    campos: {
      ...campos,
      // Mostrar longitudes para validar padding
      _debug_lengths: {
        MerchantID:  campos.MerchantID.length,
        AcquirerBIN: campos.AcquirerBIN.length,
        TerminalID:  campos.TerminalID.length,
        Num_operacion: campos.Num_operacion.length,
        Importe:     campos.Importe.length,
      },
      _env_check: {
        CECA_MERCHANT_ID_set:  !!process.env.CECA_MERCHANT_ID,
        CECA_ACQUIRER_BIN_set: !!process.env.CECA_ACQUIRER_BIN,
        CECA_TERMINAL_ID_set:  !!process.env.CECA_TERMINAL_ID,
        CECA_SECRET_KEY_set:   !!process.env.CECA_SECRET_KEY,
        CECA_CIFRADO:          process.env.CECA_CIFRADO ?? "SHA2 (default)",
      },
    },
  });
}
