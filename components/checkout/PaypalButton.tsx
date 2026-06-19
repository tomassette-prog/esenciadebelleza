"use client";

import { useState } from "react";
import { crearOrdenPaypal } from "@/actions/paypal";
import type { LineaCarrito } from "@/context/CarritoContext";

interface DatosEnvio {
  email: string; nombre: string; apellidos: string; telefono: string;
  direccion: string; ciudad: string; provincia: string; codigo_postal: string;
  notas?: string;
}

interface Props {
  lineas: LineaCarrito[];
  datosEnvio: DatosEnvio;
  disabled?: boolean;
}

export default function PaypalButton({ lineas, datosEnvio, disabled }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  async function handlePaypal() {
    setLoading(true);
    setError(null);

    const res = await crearOrdenPaypal(lineas, datosEnvio);

    if (res.error || !res.orderId) {
      setError(res.error ?? "Error al iniciar el pago con PayPal");
      setLoading(false);
      return;
    }

    // Redirigir al payer-action URL de PayPal (checkout hosted)
    window.location.href = res.orderId;
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handlePaypal}
        disabled={disabled || loading}
        className="w-full py-3.5 bg-[#FFC439] hover:bg-[#F0B429] disabled:opacity-50 transition-colors flex items-center justify-center gap-2 font-medium"
      >
        {loading ? (
          <span className="text-sm text-neutral-800">Conectando con PayPal...</span>
        ) : (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://www.paypalobjects.com/webstatic/mktg/logo/pp_cc_mark_37x23.jpg"
              alt="PayPal"
              width={37}
              height={23}
            />
            <span className="text-sm text-neutral-800 font-semibold">Pagar con PayPal</span>
          </>
        )}
      </button>

      {error && (
        <p className="text-xs text-red-600 text-center">{error}</p>
      )}

      <p className="text-xs text-neutral-400 text-center">
        Pago seguro · Protección al comprador de PayPal
      </p>
    </div>
  );
}
