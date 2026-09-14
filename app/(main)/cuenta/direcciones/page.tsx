import { createClient } from "@/lib/supabase/server";
import { getSessionFromCookie } from "@/lib/supabase/session-helper";
import { actualizarDirecciones } from "@/actions/direcciones";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mis Direcciones",
  robots: { index: false, follow: false },
};

interface Direccion {
  nombre?: string;
  apellidos?: string;
  direccion?: string;
  calle?: string;
  cp?: string;
  codigo_postal?: string;
  ciudad?: string;
  provincia?: string;
  telefono?: string;
  nif_cif?: string;
}

export default async function DireccionesPage({
  searchParams,
}: {
  searchParams?: { guardado?: string };
}) {
  const session = await getSessionFromCookie();
  const supabase = await createClient();

  const { data: perfil } = await supabase
    .from("perfiles_usuario")
    .select("direccion_envio, direccion_facturacion")
    .eq("id", session?.id)
    .single();

  const envio = (perfil?.direccion_envio ?? {}) as Direccion;
  const facturacion = (perfil?.direccion_facturacion ?? null) as Direccion | null;
  const tieneFacturacion = facturacion && Object.keys(facturacion).length > 0;

  return (
    <div>
      <h2
        className="text-2xl font-light text-neutral-900 mb-6"
        style={{ fontFamily: "var(--font-cormorant)" }}
      >
        Mis direcciones
      </h2>

      {searchParams?.guardado && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-800 text-sm">
          Direcciones guardadas correctamente.
        </div>
      )}

      <form action={actualizarDirecciones as unknown as (formData: FormData) => void} className="space-y-6">
        {/* Dirección de envío */}
        <div className="bg-white border border-neutral-100 p-6">
          <h3 className="text-xs tracking-widest uppercase text-neutral-500 mb-5">
            Dirección de envío
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs tracking-wider uppercase text-neutral-600 mb-1.5">
                Nombre
              </label>
              <input
                name="envio_nombre"
                type="text"
                defaultValue={envio.nombre ?? ""}
                className="w-full border border-neutral-200 px-3 py-2.5 text-sm focus:outline-none focus:border-neutral-900 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs tracking-wider uppercase text-neutral-600 mb-1.5">
                Apellidos
              </label>
              <input
                name="envio_apellidos"
                type="text"
                defaultValue={envio.apellidos ?? ""}
                className="w-full border border-neutral-200 px-3 py-2.5 text-sm focus:outline-none focus:border-neutral-900 transition-colors"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs tracking-wider uppercase text-neutral-600 mb-1.5">
                Dirección
              </label>
              <input
                name="envio_direccion"
                type="text"
                defaultValue={envio.direccion ?? envio.calle ?? ""}
                placeholder="Calle, número, piso, puerta"
                className="w-full border border-neutral-200 px-3 py-2.5 text-sm focus:outline-none focus:border-neutral-900 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs tracking-wider uppercase text-neutral-600 mb-1.5">
                Código postal
              </label>
              <input
                name="envio_cp"
                type="text"
                defaultValue={envio.cp ?? envio.codigo_postal ?? ""}
                placeholder="28001"
                className="w-full border border-neutral-200 px-3 py-2.5 text-sm focus:outline-none focus:border-neutral-900 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs tracking-wider uppercase text-neutral-600 mb-1.5">
                Ciudad
              </label>
              <input
                name="envio_ciudad"
                type="text"
                defaultValue={envio.ciudad ?? ""}
                className="w-full border border-neutral-200 px-3 py-2.5 text-sm focus:outline-none focus:border-neutral-900 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs tracking-wider uppercase text-neutral-600 mb-1.5">
                Provincia
              </label>
              <input
                name="envio_provincia"
                type="text"
                defaultValue={envio.provincia ?? ""}
                className="w-full border border-neutral-200 px-3 py-2.5 text-sm focus:outline-none focus:border-neutral-900 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs tracking-wider uppercase text-neutral-600 mb-1.5">
                Teléfono
              </label>
              <input
                name="envio_telefono"
                type="tel"
                defaultValue={envio.telefono ?? ""}
                placeholder="+34 600 000 000"
                className="w-full border border-neutral-200 px-3 py-2.5 text-sm focus:outline-none focus:border-neutral-900 transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Misma dirección checkbox */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            name="misma_direccion"
            id="misma_direccion"
            defaultChecked={!tieneFacturacion}
            className="rounded border-neutral-300 text-[#C4857A] focus:ring-[#C4857A]"
          />
          <label htmlFor="misma_direccion" className="text-sm text-neutral-600">
            La dirección de facturación es igual a la de envío
          </label>
        </div>

        {/* Dirección de facturación */}
        <div className="bg-white border border-neutral-100 p-6" id="facturacion-section">
          <h3 className="text-xs tracking-widest uppercase text-neutral-500 mb-5">
            Dirección de facturación
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs tracking-wider uppercase text-neutral-600 mb-1.5">
                Nombre / Razón social
              </label>
              <input
                name="fac_nombre"
                type="text"
                defaultValue={facturacion?.nombre ?? ""}
                className="w-full border border-neutral-200 px-3 py-2.5 text-sm focus:outline-none focus:border-neutral-900 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs tracking-wider uppercase text-neutral-600 mb-1.5">
                Apellidos
              </label>
              <input
                name="fac_apellidos"
                type="text"
                defaultValue={facturacion?.apellidos ?? ""}
                className="w-full border border-neutral-200 px-3 py-2.5 text-sm focus:outline-none focus:border-neutral-900 transition-colors"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs tracking-wider uppercase text-neutral-600 mb-1.5">
                Dirección
              </label>
              <input
                name="fac_direccion"
                type="text"
                defaultValue={facturacion?.direccion ?? facturacion?.calle ?? ""}
                className="w-full border border-neutral-200 px-3 py-2.5 text-sm focus:outline-none focus:border-neutral-900 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs tracking-wider uppercase text-neutral-600 mb-1.5">
                Código postal
              </label>
              <input
                name="fac_cp"
                type="text"
                defaultValue={facturacion?.cp ?? facturacion?.codigo_postal ?? ""}
                className="w-full border border-neutral-200 px-3 py-2.5 text-sm focus:outline-none focus:border-neutral-900 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs tracking-wider uppercase text-neutral-600 mb-1.5">
                Ciudad
              </label>
              <input
                name="fac_ciudad"
                type="text"
                defaultValue={facturacion?.ciudad ?? ""}
                className="w-full border border-neutral-200 px-3 py-2.5 text-sm focus:outline-none focus:border-neutral-900 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs tracking-wider uppercase text-neutral-600 mb-1.5">
                Provincia
              </label>
              <input
                name="fac_provincia"
                type="text"
                defaultValue={facturacion?.provincia ?? ""}
                className="w-full border border-neutral-200 px-3 py-2.5 text-sm focus:outline-none focus:border-neutral-900 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs tracking-wider uppercase text-neutral-600 mb-1.5">
                NIF / CIF
              </label>
              <input
                name="fac_nif_cif"
                type="text"
                defaultValue={facturacion?.nif_cif ?? ""}
                placeholder="B12345678"
                className="w-full border border-neutral-200 px-3 py-2.5 text-sm focus:outline-none focus:border-neutral-900 transition-colors"
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          className="px-6 py-2.5 bg-neutral-900 text-white text-xs tracking-widest uppercase hover:bg-neutral-700 transition-colors"
        >
          Guardar direcciones
        </button>
      </form>
    </div>
  );
}
