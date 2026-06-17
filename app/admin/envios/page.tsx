import type { Metadata } from "next";
import { getConfigTienda, actualizarConfigTienda } from "@/actions/configuracion";
import { AdminConfigForm } from "@/components/admin/AdminConfigForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Configuración de envíos | Admin",
  robots: { index: false, follow: false },
};

export default async function AdminEnviosPage() {
  const config = await getConfigTienda();

  return (
    <div className="max-w-xl space-y-8">
      <div>
        <h1
          className="text-2xl font-light text-neutral-900"
          style={{ fontFamily: "var(--font-cormorant)" }}
        >
          Configuración de envíos y precios
        </h1>
        <p className="text-sm text-neutral-400 mt-1">
          Estos valores se aplican en tiempo real al checkout y al catálogo.
        </p>
      </div>

      <AdminConfigForm config={config} action={actualizarConfigTienda} />
    </div>
  );
}
