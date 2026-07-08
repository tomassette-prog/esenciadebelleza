import { Suspense } from "react";
import Link from "next/link";
import Script from "next/script";
import ConfirmacionInner from "./confirmacion-inner";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Confirmación de pedido — Esencia de Belleza",
  robots: "noindex, nofollow",
};

export default function ConfirmacionPage() {
  return (
    <>
      <Suspense
        fallback={
          <main className="container-main py-20">
            <div className="max-w-lg mx-auto text-center">
              <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-2 border-neutral-300 border-t-neutral-900 rounded-full animate-spin" />
                <p className="text-sm text-neutral-500">Verificando pago...</p>
              </div>
            </div>
          </main>
        }
      >
        <ConfirmacionInner />
      </Suspense>
    </>
  );
}
