import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CheckoutCliente } from "@/components/checkout/CheckoutCliente";

export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false, follow: false },
};

export default async function CheckoutPage() {
  const [supabase, admin] = [await createClient(), createAdminClient()];
  const { data: { user } } = await supabase.auth.getUser();

  // Cargar configuracion de envio desde Supabase
  const { data: configRows } = await admin.from("config_tienda").select("clave, valor");
  const config: Record<string, string> = {};
  for (const row of configRows ?? []) config[row.clave] = row.valor;

  const envioGratisDesde = parseFloat(config.envio_gratis_desde ?? "49");
  const costoEnvio = parseFloat(config.envio_coste ?? "4.95");

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
        envioGratisDesde={envioGratisDesde}
        costoEnvio={costoEnvio}
      />
    </main>
  );
}
