"use client";

import { useEffect, useRef, useState } from "react";
import { crearOrdenPaypal, capturarPagoPaypal } from "@/actions/paypal";
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

declare global {
  interface Window {
    paypal?: {
      Buttons: (config: Record<string, unknown>) => { render: (el: HTMLElement) => Promise<void> };
      FUNDING: Record<string, string>;
    };
  }
}

export default function PaypalSmartButtons({ lineas, datosEnvio, disabled }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error,   setError]   = useState<string | null>(null);
  const [loaded,  setLoaded]  = useState(false);
  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;

  useEffect(() => {
    if (!clientId || disabled) return;

    // Cargar el SDK de PayPal si no está cargado
    if (window.paypal) {
      setLoaded(true);
      return;
    }

    const script = document.createElement("script");
    // Habilitar Apple Pay, Google Pay, PayPal y Venmo
    script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=EUR&locale=es_ES&components=buttons&enable-funding=applepay,googlepay,venmo&intent=capture`;
    script.async = true;
    script.onload = () => setLoaded(true);
    script.onerror = () => setError("No se pudo cargar PayPal");
    document.body.appendChild(script);

    return () => {
      // No eliminar el script al desmontar (puede ser necesario para otros renders)
    };
  }, [clientId, disabled]);

  useEffect(() => {
    if (!loaded || !containerRef.current || !window.paypal || disabled) return;

    // Limpiar renders anteriores
    containerRef.current.innerHTML = "";

    window.paypal.Buttons({
      style: {
        layout: "vertical",
        color:  "gold",
        shape:  "rect",
        label:  "pay",
        height: 45,
      },

      // Crear orden al hacer clic en el botón
      createOrder: async () => {
        setError(null);
        const res = await crearOrdenPaypal(lineas, datosEnvio);
        if (res.error || !res.orderId) {
          setError(res.error ?? "Error al crear el pago");
          throw new Error(res.error ?? "Error");
        }
        // Si el orderId es una URL (redirect), extraer el token
        const tokenMatch = res.orderId.match(/token=([^&]+)/);
        return tokenMatch ? tokenMatch[1] : res.orderId;
      },

      // Capturar pago cuando el usuario aprueba
      onApprove: async (data: { orderID: string }) => {
        const res = await capturarPagoPaypal(data.orderID);
        if (!res.ok) {
          setError(res.error ?? "Error al capturar el pago");
          return;
        }
        window.location.href = `/checkout/confirmacion?metodo=paypal&resultado=ok&num_oper=${data.orderID}`;
      },

      onError: (err: unknown) => {
        console.error("[PayPal]", err);
        setError("Error en el proceso de pago. Inténtalo de nuevo.");
      },

      onCancel: () => {
        setError(null); // silencioso al cancelar
      },
    }).render(containerRef.current!).catch(() => {
      // Puede fallar si el componente se desmonta antes de renderizar
    });
  }, [loaded, lineas, datosEnvio, disabled]);

  if (!clientId) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs text-neutral-400 text-center">o paga con</p>

      {/* PayPal Smart Buttons (incluye Apple Pay en Safari, Google Pay en Chrome) */}
      <div ref={containerRef} className="min-h-[50px]" />

      {error && (
        <p className="text-xs text-red-600 text-center">{error}</p>
      )}

      <p className="text-[10px] text-neutral-400 text-center">
        PayPal · Apple Pay · Google Pay · Tarjeta
      </p>
    </div>
  );
}
