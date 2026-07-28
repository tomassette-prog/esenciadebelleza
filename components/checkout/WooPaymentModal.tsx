"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  pagoUrl: string;
  onPagoCompletado: () => void;
  onCancelar: () => void;
}

/**
 * Modal fullscreen que carga el checkout de WooCommerce en un iframe.
 * El cliente paga sin ver que sale de esenciadebelleza.es.
 *
 * Para que funcione, depeluqueriaproductos.com debe permitir ser embebido:
 *   - En WordPress: plugin "X-Frame-Options" o header custom
 *   - O en .htaccess: Header set X-Frame-Options "ALLOW-FROM https://esenciadebelleza.es"
 *   - O CSP: frame-ancestors https://esenciadebelleza.es
 */
export default function WooPaymentModal({ pagoUrl, onPagoCompletado, onCancelar }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Detectar cuando el pago se completa (el iframe navega a order-received)
  useEffect(() => {
    const interval = setInterval(() => {
      try {
        const iframe = iframeRef.current;
        if (!iframe?.contentWindow) return;
        const url = iframe.contentWindow.location.href;
        // WC redirige a /checkout/order-received/{id} después del pago
        if (url.includes("order-received") || url.includes("thankyou")) {
          clearInterval(interval);
          onPagoCompletado();
        }
      } catch {
        // Cross-origin — no podemos leer la URL del iframe
        // Esto es esperado, WC está en otro dominio
      }
    }, 1000);

    // También escuchar mensajes postMessage de WC (si está configurado)
    function handleMessage(event: MessageEvent) {
      if (event.data?.type === "wc-payment-completed" || event.data?.type === "order-received") {
        clearInterval(interval);
        onPagoCompletado();
      }
    }
    window.addEventListener("message", handleMessage);

    return () => {
      clearInterval(interval);
      window.removeEventListener("message", handleMessage);
    };
  }, [onPagoCompletado]);

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      {/* Header minimalista — parece parte de esenciadebelleza */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-neutral-200 bg-white shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onCancelar}
            className="text-xs text-neutral-400 hover:text-neutral-700 transition-colors flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Volver al carrito
          </button>
        </div>
        <p className="text-xs text-neutral-400 tracking-wider uppercase">Pago seguro</p>
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
          </svg>
          <span className="text-xs text-neutral-500">Cifrado SSL</span>
        </div>
      </div>

      {/* Loading state */}
      {cargando && (
        <div className="absolute inset-0 flex items-center justify-center bg-white z-10">
          <div className="text-center space-y-3">
            <div className="w-10 h-10 border-2 border-neutral-200 border-t-neutral-900 rounded-full animate-spin mx-auto" />
            <p className="text-sm text-neutral-500">Cargando pasarela de pago…</p>
          </div>
        </div>
      )}

      {/* Iframe con el checkout de WC */}
      <iframe
        ref={iframeRef}
        src={pagoUrl}
        className="flex-1 w-full border-0"
        onLoad={() => setCargando(false)}
        onError={() => setError("No se pudo cargar la pasarela de pago. Intentá de nuevo.")}
        allow="payment"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-top-navigation-by-user-activation"
      />

      {/* Error state */}
      {error && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-red-50 border border-red-200 text-red-700 text-sm px-6 py-3 rounded-lg shadow-lg">
          {error}
          <button onClick={onCancelar} className="ml-4 text-red-900 font-medium underline">Volver</button>
        </div>
      )}
    </div>
  );
}
