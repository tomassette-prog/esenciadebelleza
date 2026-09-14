import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Detalle de pedido",
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

const METODO_LABEL: Record<string, string> = {
  stripe:      "Tarjeta (Stripe)",
  cecabank:    "Tarjeta (Cecabank)",
  paypal:      "PayPal",
  bizum:       "Bizum",
  contrareembolso: "Contra reembolso",
  transferencia:   "Transferencia bancaria",
};

export default async function PedidoDetallePage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login?redirectTo=/cuenta");

  // Buscar pedido — por usuario_id O por email (invitado)
  const adminClient = createAdminClient();

  const { data: pedido } = await adminClient
    .from("pedidos")
    .select(`
      *,
      pedidos_lineas ( id, nombre_producto, nombre_variacion, sku, cantidad, precio_unitario, subtotal )
    `)
    .eq("id", params.id)
    .or(`usuario_id.eq.${user.id},email_cliente.eq.${user.email}`)
    .single();

  if (!pedido) notFound();

  const dir = (pedido.direccion_envio ?? {}) as Record<string, string>;
  const estado = ESTADO_LABEL[pedido.estado] ?? { label: pedido.estado, color: "text-neutral-600 bg-neutral-100" };
  const metodo = METODO_LABEL[pedido.metodo_pago] ?? pedido.metodo_pago;
  const lineas = (pedido.pedidos_lineas ?? []) as Array<{
    id: string;
    nombre_producto: string;
    nombre_variacion: string | null;
    sku: string | null;
    cantidad: number;
    precio_unitario: number;
    subtotal: number;
  }>;

  return (
    <main className="container-main py-12">
      {/* Breadcrumb */}
      <nav className="text-xs text-neutral-400 mb-8">
        <Link href="/cuenta" className="hover:text-neutral-700 transition-colors">
          Mi cuenta
        </Link>
        <span className="mx-2">/</span>
        <span className="text-neutral-600">
          Pedido #{pedido.id.slice(0, 8).toUpperCase()}
        </span>
      </nav>

      {/* Cabecera */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div>
          <h1
            className="text-3xl font-light text-neutral-900"
            style={{ fontFamily: "var(--font-cormorant)" }}
          >
            Pedido #{pedido.id.slice(0, 8).toUpperCase()}
          </h1>
          <p className="text-sm text-neutral-500 mt-1">
            Realizado el{" "}
            {new Date(pedido.created_at).toLocaleDateString("es-ES", {
              day: "numeric",
              month: "long",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
        <span className={`text-sm px-3 py-1.5 font-medium ${estado.color}`}>
          {estado.label}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Panel principal — Líneas del pedido */}
        <div className="lg:col-span-2 space-y-6">
          {/* Productos */}
          <div className="bg-white border border-neutral-100 p-6">
            <h2 className="text-xs tracking-widest uppercase text-neutral-500 mb-5">
              Productos
            </h2>

            <div className="divide-y divide-neutral-100">
              {lineas.map((linea) => (
                <div key={linea.id} className="py-4 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-neutral-900 truncate">
                      {linea.nombre_producto}
                    </p>
                    {linea.nombre_variacion && (
                      <p className="text-xs text-neutral-400 mt-0.5">
                        {linea.nombre_variacion}
                      </p>
                    )}
                    {linea.sku && (
                      <p className="text-xs text-neutral-300 mt-0.5">
                        SKU: {linea.sku}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm text-neutral-900 tabular-nums">
                      {Number(linea.precio_unitario).toLocaleString("es-ES", {
                        style: "currency",
                        currency: "EUR",
                      })}
                      {" × "}{linea.cantidad}
                    </p>
                    <p className="text-sm font-medium text-neutral-900 tabular-nums mt-0.5">
                      {Number(linea.subtotal).toLocaleString("es-ES", {
                        style: "currency",
                        currency: "EUR",
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Resumen de importes */}
            <div className="mt-4 pt-4 border-t border-neutral-100 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-neutral-500">Subtotal</span>
                <span className="tabular-nums">
                  {Number(pedido.subtotal).toLocaleString("es-ES", {
                    style: "currency",
                    currency: "EUR",
                  })}
                </span>
              </div>
              {pedido.descuento_cupon > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>Descuento cupón</span>
                  <span className="tabular-nums">
                    −{Number(pedido.descuento_cupon).toLocaleString("es-ES", {
                      style: "currency",
                      currency: "EUR",
                    })}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-neutral-500">Gastos de envío</span>
                <span className="tabular-nums">
                  {Number(pedido.gastos_envio) === 0
                    ? "Gratis"
                    : Number(pedido.gastos_envio).toLocaleString("es-ES", {
                        style: "currency",
                        currency: "EUR",
                      })}
                </span>
              </div>
              <div className="flex justify-between text-base font-medium pt-2 border-t border-neutral-100">
                <span>Total</span>
                <span className="tabular-nums">
                  {Number(pedido.total).toLocaleString("es-ES", {
                    style: "currency",
                    currency: "EUR",
                  })}
                </span>
              </div>
            </div>
          </div>

          {/* Dirección de envío */}
          {Object.keys(dir).length > 0 && (
            <div className="bg-white border border-neutral-100 p-6">
              <h2 className="text-xs tracking-widest uppercase text-neutral-500 mb-4">
                Dirección de envío
              </h2>
              <div className="text-sm text-neutral-700 space-y-0.5">
                <p className="font-medium text-neutral-900">
                  {dir.nombre} {dir.apellidos}
                </p>
                <p>{dir.direccion}</p>
                <p>
                  {dir.codigo_postal} {dir.ciudad}
                  {dir.provincia ? `, ${dir.provincia}` : ""}
                </p>
                {dir.telefono && <p className="text-neutral-400">{dir.telefono}</p>}
                {dir.notas && (
                  <p className="text-neutral-400 italic mt-2">
                    Nota: {dir.notas}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Panel lateral — Info del pedido */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white border border-neutral-100 p-6">
            <h2 className="text-xs tracking-widest uppercase text-neutral-500 mb-4">
              Resumen
            </h2>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-neutral-500">Nº Pedido</dt>
                <dd className="font-mono text-neutral-900">
                  #{pedido.id.slice(0, 8).toUpperCase()}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-neutral-500">Fecha</dt>
                <dd className="text-neutral-900">
                  {new Date(pedido.created_at).toLocaleDateString("es-ES")}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-neutral-500">Método de pago</dt>
                <dd className="text-neutral-900">{metodo}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-neutral-500">Tipo de precio</dt>
                <dd className="text-neutral-900">
                  {pedido.tipo_precio === "b2b" ? "Profesional" : "Particular"}
                </dd>
              </div>
            </dl>
          </div>

          {/* Acciones */}
          <div className="bg-white border border-neutral-100 p-6">
            <h2 className="text-xs tracking-widest uppercase text-neutral-500 mb-4">
              ¿Necesitas ayuda?
            </h2>
            <p className="text-sm text-neutral-500 mb-4">
              Si tienes alguna duda sobre tu pedido, no dudes en contactarnos.
            </p>
            <Link
              href="/sobre-nosotros"
              className="block text-center w-full py-2.5 bg-neutral-900 text-white text-xs tracking-widest uppercase hover:bg-neutral-700 transition-colors"
            >
              Contactar
            </Link>
          </div>

          <Link
            href="/cuenta"
            className="flex items-center gap-2 text-sm text-neutral-400 hover:text-neutral-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Volver a mi cuenta
          </Link>
        </div>
      </div>
    </main>
  );
}
