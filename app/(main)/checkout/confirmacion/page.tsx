"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useCarrito } from "@/context/CarritoContext";
import { loadStripe } from "@stripe/stripe-js";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

type Estado = "cargando" | "exito" | "procesando" | "error";

export default function ConfirmacionPage() {
  const searchParams = useSearchParams();
  const { vaciar }   = useCarrito();
  const [estado, setEstado]   = useState<Estado>("cargando");
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    const clientSecret      = searchParams.get("payment_intent_client_secret");
    const paymentIntentId   = searchParams.get("payment_intent");

    if (!clientSecret || !paymentIntentId) {
      setEstado("error");
      setMensaje("No se encontró información del pago.");
      return;
    }

    stripePromise.then(async (stripe) => {
      if (!stripe) return;

      const { paymentIntent } = await stripe.retrievePaymentIntent(clientSecret);

      switch (paymentIntent?.status) {
        case "succeeded":
          vaciar(); // Limpiar carrito
          setEstado("exito");
          break;
        case "processing":
          setEstado("procesando");
          break;
        default:
          setEstado("error");
          setMensaje("El pago no se completó. Inténtalo de nuevo.");
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
            <div className="w-16 h-16 bg-green-50 border border-green-200 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <h1
              className="text-3xl font-light text-neutral-900 mb-3"
              style={{ fontFamily: "var(--font-cormorant)" }}
            >
              ¡Pedido confirmado!
            </h1>
            <p className="text-neutral-500 mb-2">
              Gracias por tu compra. Recibirás un email de confirmación en breve.
            </p>
            <p className="text-sm text-neutral-400 mb-10">
              Tu pedido está siendo preparado por nuestro equipo. Te avisaremos cuando esté enviado.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/cuenta"
                className="px-8 py-3 bg-neutral-900 text-white text-xs tracking-widest uppercase hover:bg-neutral-700 transition-colors"
              >
                Ver mis pedidos
              </Link>
              <Link
                href="/productos/peluqueria"
                className="px-8 py-3 border border-neutral-200 text-xs tracking-widest uppercase hover:border-neutral-900 transition-colors"
              >
                Seguir comprando
              </Link>
            </div>
          </>
        )}

        {estado === "procesando" && (
          <>
            <div className="w-16 h-16 bg-blue-50 border border-blue-200 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h1
              className="text-3xl font-light text-neutral-900 mb-3"
              style={{ fontFamily: "var(--font-cormorant)" }}
            >
              Pago en proceso
            </h1>
            <p className="text-neutral-500 mb-8">
              Tu pago está siendo procesado. Te enviaremos un email cuando se confirme.
            </p>
            <Link href="/cuenta" className="text-sm text-neutral-900 underline">
              Ver mi cuenta
            </Link>
          </>
        )}

        {estado === "error" && (
          <>
            <div className="w-16 h-16 bg-red-50 border border-red-200 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <h1
              className="text-3xl font-light text-neutral-900 mb-3"
              style={{ fontFamily: "var(--font-cormorant)" }}
            >
              Algo fue mal
            </h1>
            <p className="text-neutral-500 mb-8">
              {mensaje || "No se pudo procesar el pago. Por favor, inténtalo de nuevo."}
            </p>
            <Link
              href="/checkout"
              className="px-8 py-3 bg-neutral-900 text-white text-xs tracking-widest uppercase hover:bg-neutral-700 transition-colors"
            >
              Volver al checkout
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
