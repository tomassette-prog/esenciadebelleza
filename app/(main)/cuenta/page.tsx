import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { logout, actualizarPerfil } from "@/actions/auth";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mi Cuenta",
  robots: { index: false, follow: false },
};

export default async function CuentaPage({
  searchParams,
}: {
  searchParams: { bienvenido?: string; password_actualizado?: string };
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login?redirectTo=/cuenta");

  // Perfil de usuario
  const { data: perfil } = await supabase
    .from("perfiles_usuario")
    .select("*")
    .eq("id", user.id)
    .single();

  // Últimos 5 pedidos
  const { data: pedidos } = await supabase
    .from("pedidos")
    .select("id, estado, total, created_at, numero_pedido")
    .eq("usuario_id", user.id)
    .order("created_at", { ascending: false })
    .limit(5);

  const esProfesional = perfil?.tipo_cliente === "b2b";
  const b2bAprobado   = perfil?.b2b_aprobado === true;

  const ESTADO_LABEL: Record<string, { label: string; color: string }> = {
    pendiente:   { label: "Pendiente",   color: "text-amber-600 bg-amber-50"   },
    pagado:      { label: "Pagado",      color: "text-blue-600 bg-blue-50"     },
    preparando:  { label: "Preparando",  color: "text-purple-600 bg-purple-50" },
    enviado:     { label: "Enviado",     color: "text-indigo-600 bg-indigo-50" },
    entregado:   { label: "Entregado",   color: "text-green-600 bg-green-50"   },
    cancelado:   { label: "Cancelado",   color: "text-red-600 bg-red-50"       },
    reembolsado: { label: "Reembolsado", color: "text-neutral-600 bg-neutral-100" },
  };

  return (
    <main className="container-main py-12">
      {/* Cabecera */}
      <div className="flex items-start justify-between mb-10">
        <div>
          <h1
            className="text-3xl font-light text-neutral-900"
            style={{ fontFamily: "var(--font-cormorant)" }}
          >
            Mi Cuenta
          </h1>
          <p className="text-sm text-neutral-500 mt-1">{user.email}</p>
        </div>

        <form action={logout}>
          <button
            type="submit"
            className="text-xs tracking-widest uppercase text-neutral-400 hover:text-neutral-900 border border-neutral-200 px-4 py-2 transition-colors"
          >
            Cerrar sesión
          </button>
        </form>
      </div>

      {/* Banners de bienvenida */}
      {searchParams.bienvenido && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-800 text-sm">
          ¡Cuenta creada correctamente! Bienvenida a Esencia de Belleza.
          {esProfesional && !b2bAprobado && (
            <span className="block mt-1">
              Tu cuenta profesional está pendiente de verificación (24-48 h). Recibirás un email cuando esté activa.
            </span>
          )}
        </div>
      )}

      {searchParams.password_actualizado && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-800 text-sm">
          Contraseña actualizada correctamente.
        </div>
      )}

      {/* Badge profesional */}
      {esProfesional && (
        <div
          className={`mb-6 p-4 border text-sm flex items-center gap-3 ${
            b2bAprobado
              ? "bg-[#C9A84C]/10 border-[#C9A84C]/30 text-[#8B6914]"
              : "bg-amber-50 border-amber-200 text-amber-800"
          }`}
        >
          <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {b2bAprobado
            ? `Cuenta profesional activa${perfil?.empresa ? ` — ${perfil.empresa}` : ""}. Tienes acceso a precios de tarifa B2B.`
            : "Cuenta profesional pendiente de verificación. Recibirás un email cuando esté aprobada."}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Panel izquierdo — Perfil */}
        <div className="lg:col-span-1">
          <div className="bg-white border border-neutral-100 p-6">
            <h2 className="text-xs tracking-widest uppercase text-neutral-500 mb-5">
              Mis datos
            </h2>

            <form action={actualizarPerfil} className="space-y-4">
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

              {esProfesional && (
                <>
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
                </>
              )}

              <button
                type="submit"
                className="w-full py-2.5 bg-neutral-900 text-white text-xs tracking-widest uppercase hover:bg-neutral-700 transition-colors"
              >
                Guardar cambios
              </button>
            </form>

            <div className="mt-4 pt-4 border-t border-neutral-100">
              <Link
                href="/recuperar"
                className="text-xs text-neutral-400 hover:text-neutral-700 transition-colors"
              >
                Cambiar contraseña →
              </Link>
            </div>
          </div>
        </div>

        {/* Panel derecho — Pedidos */}
        <div className="lg:col-span-2">
          <div className="bg-white border border-neutral-100 p-6">
            <h2 className="text-xs tracking-widest uppercase text-neutral-500 mb-5">
              Mis pedidos
            </h2>

            {!pedidos || pedidos.length === 0 ? (
              <div className="text-center py-12">
                <svg className="w-12 h-12 text-neutral-200 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                    d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007z" />
                </svg>
                <p className="text-sm text-neutral-500 mb-4">Aún no tienes pedidos</p>
                <Link
                  href="/productos/peluqueria"
                  className="text-xs tracking-widest uppercase text-neutral-900 border border-neutral-900 px-6 py-2 hover:bg-neutral-900 hover:text-white transition-colors"
                >
                  Explorar productos
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-neutral-100">
                {pedidos.map((pedido) => {
                  const estado = ESTADO_LABEL[pedido.estado] ?? { label: pedido.estado, color: "text-neutral-600 bg-neutral-100" };
                  return (
                    <div key={pedido.id} className="py-4 flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium text-neutral-900">
                          #{pedido.numero_pedido ?? pedido.id.slice(0, 8).toUpperCase()}
                        </p>
                        <p className="text-xs text-neutral-400 mt-0.5">
                          {new Date(pedido.created_at).toLocaleDateString("es-ES", {
                            day: "numeric", month: "long", year: "numeric",
                          })}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-xs px-2.5 py-1 font-medium ${estado.color}`}>
                          {estado.label}
                        </span>
                        <span className="text-sm font-medium text-neutral-900 tabular-nums">
                          {Number(pedido.total).toLocaleString("es-ES", { style: "currency", currency: "EUR" })}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
