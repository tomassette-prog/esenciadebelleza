"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Script from "next/script";
import { useCarrito } from "@/context/CarritoContext";
import { confirmarPedidoCeca, confirmarPedidoStripe } from "@/actions/checkout";

type Estado = "cargando" | "exito" | "error";

interface OrderData {
  orderId: string;
  email: string;
}

export default function ConfirmacionInner() {
  const searchParams = useSearchParams();
  const { vaciar }   = useCarrito();
  const [estado, setEstado] = useState<Estado>("cargando");
  const [orderData, setOrderData] = useState<OrderData | null>(null);

  useEffect(() => {
    const numOper   = searchParams.get("num_oper")    ?? "";
    const sessionId = searchParams.get("session_id")  ?? "";
    const resultado = searchParams.get("resultado")   ?? "";

    // Pago cancelado
    if (resultado === "ko") {
      setEstado("error");
      return;
    }

    // ── Flujo Stripe ────────────────────────────────────────────────────────
    if (sessionId) {
      confirmarPedidoStripe(sessionId).then(({ ok, email, pedidoId }) => {
        if (ok) {
          vaciar();
          if (email && pedidoId) {
            setOrderData({ orderId: pedidoId, email });
          }
          setEstado("exito");
        } else {
          setEstado("error");
        }
      });
      return;
    }

    // ── Flujo Cecabank ──────────────────────────────────────────────────────
    if (!numOper) {
      setEstado("error");
      return;
    }

    confirmarPedidoCeca(numOper).then(({ ok, email, pedidoId }) => {
      if (ok) {
        vaciar();
        if (email && pedidoId) {
          setOrderData({ orderId: pedidoId, email });
        }
        setEstado("exito");
      } else {
        setEstado("error");
      }
    });
  }, [searchParams, vaciar]);

  return (
    <main className="container-main py-20">
      <div className="max-w-lg mx-auto text-center">
        {estado === "cargando" && (
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-2 border-neutral-300 border-t-neutral-900 rounded-full animate-spin" />
            <p className="text-sm text-neutral-500">Verificando pago...</p>
          </div>
        )}

        {estado === "exito" && (
          <>
            {/* Google Customer Reviews opt-in */}
            {orderData && (
              <>
                <Script src="https://apis.google.com/js/platform.js?onload=renderOptIn" strategy="afterInteractive" />
                <Script id="gcr-optin" strategy="afterInteractive" dangerouslySetInnerHTML={{
                  __html: `
                    window.renderOptIn = function() {
                      window.gapi.load('surveyoptin', function() {
                        window.gapi.surveyoptin.render({
                          "merchant_id": 5816732573,
                          "order_id": "${orderData.orderId}",
                          "email": "${orderData.email}",
                          "delivery_country": "ES",
                          "estimated_delivery_date": "${new Date(Date.now() + 4 * 86400000).toISOString().split('T')[0]}"
                        });
                      });
                    }
                  `
                }} />
              </>
            )}
            <div className="w-16 h-16 bg-green-50 border border-green-200 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <h1
              className="text-3xl font-light text-neutral-900 mb-3"
              style={{ fontFamily: "var(--font-cormorant)" }}
            >
              Pedido confirmado
            </h1>
            <p className="text-neutral-600 mb-2">
              Recibirás un email de confirmación en los próximos minutos con el número de seguimiento y detalles de tu pedido.
            </p>
            <p className="text-sm text-neutral-500 mb-8">
              Si no lo recibiste, revisa tu carpeta de spam.
            </p>
            <Link
              href="/"
              className="inline-block px-8 py-3 bg-rose-100 text-rose-900 rounded-full hover:bg-rose-200 transition-colors font-medium text-sm"
            >
              Volver a la tienda
            </Link>
          </>
        )}

        {estado === "error" && (
          <>
            <div className="w-16 h-16 bg-red-50 border border-red-200 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1
              className="text-3xl font-light text-neutral-900 mb-3"
              style={{ fontFamily: "var(--font-cormorant)" }}
            >
              Pago no confirmado
            </h1>
            <p className="text-neutral-600 mb-8">
              No pudimos confirmar tu pago. Por favor, intenta de nuevo.
            </p>
            <Link
              href="/checkout"
              className="inline-block px-8 py-3 bg-rose-100 text-rose-900 rounded-full hover:bg-rose-200 transition-colors font-medium text-sm"
            >
              Volver al checkout
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
