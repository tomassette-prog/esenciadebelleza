import Link from "next/link";
import { getSessionFromCookie } from "@/lib/supabase/session-helper";
import { createAdminClient } from "@/lib/supabase/admin";
import { actualizarPerfil } from "@/actions/auth";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Mis Datos",
  robots: { index: false, follow: false },
};

export default async function DatosPage() {
  const session = await getSessionFromCookie();
  if (!session) return null;

  const admin = createAdminClient();

  const { data: perfil } = await admin
    .from("perfiles_usuario")
    .select("*")
    .eq("id", session.id)
    .single();

  const esProfesional = perfil?.tipo_cliente === "b2b";

  return (
    <div>
      <h2
        className="text-2xl font-light text-neutral-900 mb-6"
        style={{ fontFamily: "var(--font-cormorant)" }}
      >
        Mis datos
      </h2>

      <div className="space-y-6">
        {/* Datos personales */}
        <div className="bg-white border border-neutral-100 p-6">
          <h3 className="text-xs tracking-widest uppercase text-neutral-500 mb-5">
            Información personal
          </h3>

          <form action={actualizarPerfil as (formData: FormData) => void} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs tracking-wider uppercase text-neutral-600 mb-1.5">
                  Nombre completo
                </label>
                <input
                  name="nombre_completo"
                  type="text"
                  defaultValue={perfil?.nombre_completo ?? ""}
                  required
                  className="w-full border border-neutral-200 px-3 py-2.5 text-sm focus:outline-none focus:border-neutral-900 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs tracking-wider uppercase text-neutral-600 mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  value={session.email ?? ""}
                  disabled
                  className="w-full border border-neutral-100 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-400"
                />
                <p className="text-xs text-neutral-300 mt-1">El email no se puede cambiar</p>
              </div>

              <div>
                <label className="block text-xs tracking-wider uppercase text-neutral-600 mb-1.5">
                  Teléfono
                </label>
                <input
                  name="telefono"
                  type="tel"
                  defaultValue={perfil?.telefono ?? ""}
                  placeholder="+34 600 000 000"
                  className="w-full border border-neutral-200 px-3 py-2.5 text-sm focus:outline-none focus:border-neutral-900 transition-colors"
                />
              </div>
            </div>

            {esProfesional && (
              <div className="pt-4 border-t border-neutral-100">
                <h4 className="text-xs tracking-widest uppercase text-neutral-500 mb-4">
                  Datos profesionales
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs tracking-wider uppercase text-neutral-600 mb-1.5">
                      Empresa
                    </label>
                    <input
                      name="empresa"
                      type="text"
                      defaultValue={perfil?.empresa ?? ""}
                      className="w-full border border-neutral-200 px-3 py-2.5 text-sm focus:outline-none focus:border-neutral-900 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs tracking-wider uppercase text-neutral-600 mb-1.5">
                      NIF / CIF
                    </label>
                    <input
                      name="nif_cif"
                      type="text"
                      defaultValue={perfil?.nif_cif ?? ""}
                      placeholder="B12345678"
                      className="w-full border border-neutral-200 px-3 py-2.5 text-sm focus:outline-none focus:border-neutral-900 transition-colors"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="pt-4">
              <button
                type="submit"
                className="px-6 py-2.5 bg-neutral-900 text-white text-xs tracking-widest uppercase hover:bg-neutral-700 transition-colors"
              >
                Guardar cambios
              </button>
            </div>
          </form>
        </div>

        {/* Seguridad */}
        <div className="bg-white border border-neutral-100 p-6">
          <h3 className="text-xs tracking-widest uppercase text-neutral-500 mb-4">
            Seguridad
          </h3>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-900">Contraseña</p>
              <p className="text-xs text-neutral-400 mt-0.5">Última actualización: nunca</p>
            </div>
            <Link
              href="/recuperar"
              className="text-xs tracking-widest uppercase text-neutral-900 border border-neutral-200 px-4 py-2 hover:bg-neutral-900 hover:text-white transition-colors"
            >
              Cambiar
            </Link>
          </div>
        </div>

        {/* Tipo de cuenta */}
        <div className="bg-white border border-neutral-100 p-6">
          <h3 className="text-xs tracking-widest uppercase text-neutral-500 mb-4">
            Tipo de cuenta
          </h3>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-900">
                {esProfesional ? "Cuenta profesional" : "Cuenta particular"}
              </p>
              <p className="text-xs text-neutral-400 mt-0.5">
                {esProfesional
                  ? (perfil?.b2b_aprobado ? "Verificada — Precios B2B activos" : "Pendiente de verificación")
                  : "Precios para particulares"}
              </p>
            </div>
            {!esProfesional && (
              <Link
                href="/profesionales"
                className="text-xs tracking-widest uppercase text-[#C4857A] border border-[#C4857A]/30 px-4 py-2 hover:bg-[#C4857A] hover:text-white transition-colors"
              >
                Hacerme profesional
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
