import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { CheckoutCliente } from "@/components/checkout/CheckoutCliente";

export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false, follow: false },
};

export default async function CheckoutPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <main className="container-main py-12">
      <h1
        className="text-3xl font-light text-neutral-900 mb-10"
        style={{ fontFamily: "var(--font-cormorant)" }}
      >
        Finalizar compra
      </h1>

      <CheckoutCliente
        emailInicial={user?.email}
      />
    </main>
  );
}
