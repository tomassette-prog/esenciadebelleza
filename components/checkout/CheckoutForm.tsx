"use client";

import { useState } from "react";
import {
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { useCarrito } from "@/context/CarritoContext";

interface Props {
  datosEnvio: {
    email:         string;
    nombre:        string;
    apellidos:     string;
    telefono:      string;
    direccion:     string;
    ciudad:        string;
    provincia:     string;
    codigo_postal: string;
    notas?:        string;
  };
  onExito: () => void;
}

export function CheckoutForm({ datosEnvio, onExito }: Props) {
  const stripe   = useStripe();
  const elements = useElements();
  const { lineas, vaciar } = useCarrito();

  const [procesando, setProcesando] = useState(false);
  const [error, setError]           = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;

    setProcesando(true);
    setError(null);

    // Actualizar metadatos del Payment Intent con los datos del pedido
    // para que el webhook de Stripe pueda crear el pedido en WooCommerce
    const checkoutData = {
      ...datosEnvio,
      lineas: lineas.map((l) => ({ sku: l.sku, cantidad: l.cantidad, precio: l.precio })),
    };

    const { error: updateError } = await stripe.updatePaymentIntent?.({
      metadata: { checkout_data: JSON.stringify(checkoutData) },
    }) ?? {};

    if (updateError) {
      // No es un error bloqueante — el webhook usará los datos del PI
      console.warn("No se pudieron actualizar metadatos del PI:", updateError);
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin;

    const { error: confirmError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${siteUrl}/checkout/confirmacion`,
        payment_method_data: {
          billing_details: {
            name:  `${datosEnvio.nombre} ${datosEnvio.apellidos}`,
            email: datosEnvio.email,
            phone: datosEnvio.telefono,
            address: {
              line1:       datosEnvio.direccion,
              city:        datosEnvio.ciudad,
              state:       datosEnvio.provincia,
              postal_code: datosEnvio.codigo_postal,
              country:     "ES",
            },
          },
        },
      },
    });

    // Si llegamos aquí es que hubo un error (el éxito redirige a return_url)
    if (confirmError) {
      if (confirmError.type === "card_error" || confirmError.type === "validation_error") {
        setError(confirmError.message ?? "Error en el pago");
      } else {
        setError("Ocurrió un error inesperado. Inténtalo de nuevo.");
      }
    }

    setProcesando(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Stripe Payment Element (tarjeta + Bizum + etc.) */}
      <PaymentElement
        options={{
          layout: "tabs",
          fields: { billingDetails: "never" }, // ya lo enviamos nosotros
        }}
      />

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={!stripe || !elements || procesando}
        className="w-full py-4 bg-neutral-900 text-white text-xs tracking-widest uppercase font-medium hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {procesando ? "Procesando pago..." : "Confirmar y pagar"}
      </button>

      <p className="text-xs text-neutral-400 text-center flex items-center justify-center gap-2">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
        </svg>
        Pago seguro cifrado con SSL · Powered by Stripe
      </p>
    </form>
  );
}
