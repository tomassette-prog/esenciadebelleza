import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
// getSessionFromCookie removed — using supabase.auth.getUser()
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Mis Pedidos",
  robots: { index: false, follow: false },
};

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

export default async function PedidosPage() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return null;
  const user = session.user;

  const { data: pedidosPropios } = await supabase
    .from("pedidos")
    .select("id, estado, total, created_at, metodo_pago")
    .eq("usuario_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  const { data: pedidosEmail } = await supabase
    .from("pedidos")
    .select("id, estado, total, created_at, metodo_pago")
    .eq("email_cliente", user.email)
    .is("usuario_id", null)
    .order("created_at", { ascending: false })
    .limit(50);

  const pedidos = [...(pedidosPropios ?? []), ...(pedidosEmail ?? [])]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return (
    <div>
      <h2
        className="text-2xl font-light text-neutral-900 mb-6"
        style={{ fontFamily: "var(--font-cormorant)" }}
      >
        Mis pedidos
      </h2>

      {!pedidos.length ? (
        <div className="bg-white border border-neutral-100 text-center py-16">
          <svg className="w-12 h-12 text-neutral-200 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
              d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007z" />
          </svg>
          <p className="text-sm text-neutral-500 mb-4">Aún no tienes pedidos</p>
          <Link
            href="/productos/peluqueria"
            className="inline-block text-xs tracking-widest uppercase text-neutral-900 border border-neutral-900 px-6 py-2 hover:bg-neutral-900 hover:text-white transition-colors"
          >
            Explorar productos
          </Link>
        </div>
      ) : (
        <div className="bg-white border border-neutral-100">
          {/* Header */}
          <div className="hidden sm:grid grid-cols-12 gap-4 px-6 py-3 border-b border-neutral-100 text-xs tracking-widest uppercase text-neutral-400">
            <div className="col-span-3">Pedido</div>
            <div className="col-span-3">Fecha</div>
            <div className="col-span-2">Estado</div>
            <div className="col-span-2">Método</div>
            <div className="col-span-2 text-right">Total</div>
          </div>

          {/* Rows */}
          <div className="divide-y divide-neutral-100">
            {pedidos.map((pedido) => {
              const estado = ESTADO_LABEL[pedido.estado] ?? { label: pedido.estado, color: "text-neutral-600 bg-neutral-100" };
              return (
                <Link
                  key={pedido.id}
                  href={`/cuenta/pedidos/${pedido.id}`}
                  className="grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-4 px-6 py-4 hover:bg-neutral-50 transition-colors group"
                >
                  <div className="sm:col-span-3">
                    <span className="text-sm font-medium text-neutral-900 group-hover:text-[#C4857A] transition-colors">
                      #{pedido.id.slice(0, 8).toUpperCase()}
                    </span>
                  </div>
                  <div className="sm:col-span-3">
                    <span className="text-sm text-neutral-500">
                      {new Date(pedido.created_at).toLocaleDateString("es-ES", {
                        day: "numeric", month: "long", year: "numeric",
                      })}
                    </span>
                  </div>
                  <div className="sm:col-span-2">
                    <span className={`text-xs px-2.5 py-1 font-medium ${estado.color}`}>
                      {estado.label}
                    </span>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-sm text-neutral-500 capitalize">
                      {pedido.metodo_pago ?? "—"}
                    </span>
                  </div>
                  <div className="sm:col-span-2 flex items-center justify-end gap-2">
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
        </div>
      )}
    </div>
  );
}
