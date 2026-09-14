import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSessionFromCookie } from "@/lib/supabase/session-helper";
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
  const session = await getSessionFromCookie();
  const supabase = await createClient();

  // Perfil
  const { data: perfil } = await supabase
    .from("perfiles_usuario")
    .select("*")
    .eq("id", session?.id)
    .single();

  // Pedidos recientes (últimos 5)
  const { data: pedidosPropios } = await supabase
    .from("pedidos")
    .select("id, estado, total, created_at, metodo_pago")
    .eq("usuario_id", session?.id)
    .order("created_at", { ascending: false })
    .limit(5);

  const { data: pedidosEmail } = await supabase
    .from("pedidos")
    .select("id, estado, total, created_at, metodo_pago")
    .eq("email_cliente", session?.email)
    .is("usuario_id", null)
    .order("created_at", { ascending: false })
    .limit(5);

  const pedidosRecientes = [...(pedidosPropios ?? []), ...(pedidosEmail ?? [])]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  // Conteo total de pedidos
  const { count: totalPedidos } = await supabase
    .from("pedidos")
    .select("id", { count: "exact", head: true })
    .or(`usuario_id.eq.${session?.id},email_cliente.eq.${session?.email}`);

  // Total gastado
  const todosPedidos = [...(pedidosPropios ?? []), ...(pedidosEmail ?? [])];
  const totalGastado = todosPedidos.reduce((acc, p) => acc + Number(p.total), 0);

  const esProfesional = perfil?.tipo_cliente === "b2b";
  const b2bAprobado = perfil?.b2b_aprobado === true;

  const ESTADO_LABEL: Record<string, { label: string; color: string }> = {
    pendiente:        { label: "Pendiente",        color: "text-amber-600 bg-amber-50"     },
    pendiente_bizum:  { label: "Pendiente Bizum",  color: "text-amber-600 bg-amber-50"     },
    pagado:           { label: "Pagado",           color: "text-blue-600 bg-blue-50"       },
    preparando:       { label: "Preparando",       color: "text-purple-600 bg-purple-50"   },
    enviado:          { label: "Enviado",          color: "text-indigo-600 bg-indigo-50"   },
    entregado:        { label: "Entregado",        color: "text-green-600 bg-green-50"     },
    cancelado:        { label: "Cancelado",        color: "text-red-600 bg-red-50"         },
    reembolsado:      { label: "Reembolsado",      color: "text-neutral-600 bg-neutral-100" },
  };

  return (
    <div className="space-y-6">
      {/* Banners */}
      {searchParams.bienvenido && (
        <div className="p-4 bg-green-50 border border-green-200 text-green-800 text-sm">
          ¡Cuenta creada correctamente! Bienvenida a Esencia de Belleza.
          {esProfesional && !b2bAprobado && (
            <span className="block mt-1">
              Tu cuenta profesional está pendiente de verificación (24-48 h).
            </span>
          )}
        </div>
      )}

      {searchParams.password_actualizado && (
        <div className="p-4 bg-green-50 border border-green-200 text-green-800 text-sm">
          Contraseña actualizada correctamente.
        </div>
      )}

      {/* Saludo */}
      <div>
        <h2
          className="text-2xl font-light text-neutral-900"
          style={{ fontFamily: "var(--font-cormorant)" }}
        >
          Hola, {perfil?.nombre_completo?.split(" ")[0] ?? "bienvenido"}
        </h2>
        <p className="text-sm text-neutral-500 mt-1">
          Desde aquí puedes gestionar tus pedidos, datos y direcciones.
        </p>
      </div>

      {/* Stats rápidas */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-neutral-100 p-5">
          <p className="text-xs tracking-widest uppercase text-neutral-400 mb-1">Pedidos</p>
          <p className="text-2xl font-light text-neutral-900">{totalPedidos ?? 0}</p>
        </div>
        <div className="bg-white border border-neutral-100 p-5">
          <p className="text-xs tracking-widest uppercase text-neutral-400 mb-1">Total gastado</p>
          <p className="text-2xl font-light text-neutral-900">
            {totalGastado.toLocaleString("es-ES", { style: "currency", currency: "EUR" })}
          </p>
        </div>
        <div className="bg-white border border-neutral-100 p-5 col-span-2 sm:col-span-1">
          <p className="text-xs tracking-widest uppercase text-neutral-400 mb-1">Tipo de cuenta</p>
          <p className="text-2xl font-light text-neutral-900">
            {esProfesional ? (b2bAprobado ? "Profesional" : "Pendiente") : "Particular"}
          </p>
        </div>
      </div>

      {/* Accesos rápidos */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Link
          href="/cuenta/pedidos"
          className="flex flex-col items-center gap-2 p-4 bg-white border border-neutral-100 hover:border-[#C4857A]/30 hover:bg-[#C4857A]/5 transition-colors group"
        >
          <svg className="w-6 h-6 text-neutral-400 group-hover:text-[#C4857A] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007z" />
          </svg>
          <span className="text-xs tracking-wider uppercase text-neutral-600 group-hover:text-[#7A4A40] transition-colors">Pedidos</span>
        </Link>
        <Link
          href="/cuenta/datos"
          className="flex flex-col items-center gap-2 p-4 bg-white border border-neutral-100 hover:border-[#C4857A]/30 hover:bg-[#C4857A]/5 transition-colors group"
        >
          <svg className="w-6 h-6 text-neutral-400 group-hover:text-[#C4857A] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
          </svg>
          <span className="text-xs tracking-wider uppercase text-neutral-600 group-hover:text-[#7A4A40] transition-colors">Datos</span>
        </Link>
        <Link
          href="/cuenta/direcciones"
          className="flex flex-col items-center gap-2 p-4 bg-white border border-neutral-100 hover:border-[#C4857A]/30 hover:bg-[#C4857A]/5 transition-colors group"
        >
          <svg className="w-6 h-6 text-neutral-400 group-hover:text-[#C4857A] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
          </svg>
          <span className="text-xs tracking-wider uppercase text-neutral-600 group-hover:text-[#7A4A40] transition-colors">Direcciones</span>
        </Link>
        <Link
          href="/cuenta/facturas"
          className="flex flex-col items-center gap-2 p-4 bg-white border border-neutral-100 hover:border-[#C4857A]/30 hover:bg-[#C4857A]/5 transition-colors group"
        >
          <svg className="w-6 h-6 text-neutral-400 group-hover:text-[#C4857A] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
          <span className="text-xs tracking-wider uppercase text-neutral-600 group-hover:text-[#7A4A40] transition-colors">Facturas</span>
        </Link>
      </div>

      {/* Pedidos recientes */}
      <div className="bg-white border border-neutral-100 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xs tracking-widest uppercase text-neutral-500">
            Pedidos recientes
          </h2>
          {(totalPedidos ?? 0) > 5 && (
            <Link href="/cuenta/pedidos" className="text-xs text-[#C4857A] hover:text-[#7A4A40] transition-colors">
              Ver todos →
            </Link>
          )}
        </div>

        {!pedidosRecientes.length ? (
          <div className="text-center py-10">
            <svg className="w-10 h-10 text-neutral-200 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007z" />
            </svg>
            <p className="text-sm text-neutral-500 mb-3">Aún no tienes pedidos</p>
            <Link
              href="/productos/peluqueria"
              className="inline-block text-xs tracking-widest uppercase text-neutral-900 border border-neutral-900 px-5 py-2 hover:bg-neutral-900 hover:text-white transition-colors"
            >
              Explorar productos
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-neutral-100">
            {pedidosRecientes.map((pedido) => {
              const estado = ESTADO_LABEL[pedido.estado] ?? { label: pedido.estado, color: "text-neutral-600 bg-neutral-100" };
              return (
                <Link
                  key={pedido.id}
                  href={`/cuenta/pedidos/${pedido.id}`}
                  className="py-3 flex items-center justify-between gap-4 hover:bg-neutral-50 -mx-3 px-3 transition-colors group"
                >
                  <div>
                    <p className="text-sm font-medium text-neutral-900 group-hover:text-[#C4857A] transition-colors">
                      #{pedido.id.slice(0, 8).toUpperCase()}
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
                    <svg className="w-4 h-4 text-neutral-300 group-hover:text-neutral-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
