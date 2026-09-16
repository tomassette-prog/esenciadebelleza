import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { obtenerDetalleCliente } from "@/actions/clientes";
import { HistorialPedidos } from "@/components/admin/HistorialPedidos";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Detalle Cliente | Admin",
  robots: { index: false, follow: false },
};

export default async function DetalleClientePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { cliente, error } = await obtenerDetalleCliente(id);

  if (error || !cliente) notFound();

  const dir = cliente.direccion_envio as { calle?: string; cp?: string; ciudad?: string; provincia?: string } | null;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <Link
          href="/admin/clientes"
          className="text-xs text-neutral-500 hover:text-neutral-900 transition-colors"
        >
          ← Volver a clientes
        </Link>
      </div>

      <div className="flex items-start justify-between mb-8">
        <div>
          <h1
            className="text-2xl font-light text-neutral-900 mb-1"
            style={{ fontFamily: "var(--font-cormorant)" }}
          >
            {cliente.nombre_completo ?? cliente.empresa ?? "Sin nombre"}
          </h1>
          <p className="text-sm text-neutral-500">{cliente.email}</p>
        </div>
        <span className={`text-[10px] tracking-wider uppercase px-3 py-1 rounded ${
          cliente.tipo_cliente === "b2b"
            ? "bg-[#C4857A]/10 text-[#7A4A40]"
            : "bg-neutral-100 text-neutral-500"
        }`}>
          {cliente.tipo_cliente === "b2b" ? "Profesional B2B" : "Particular B2C"}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna izquierda: datos + dirección */}
        <div className="lg:col-span-2 space-y-6">
          {/* Datos personales */}
          <section className="bg-white border border-neutral-100 p-5">
            <h2 className="text-xs tracking-widest uppercase text-neutral-500 mb-4">
              Datos personales
            </h2>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div>
                <dt className="text-neutral-400 text-xs">Nombre</dt>
                <dd className="text-neutral-900">{cliente.nombre_completo ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-neutral-400 text-xs">Email</dt>
                <dd className="text-neutral-900">{cliente.email}</dd>
              </div>
              <div>
                <dt className="text-neutral-400 text-xs">Empresa</dt>
                <dd className="text-neutral-900">{cliente.empresa ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-neutral-400 text-xs">NIF/CIF</dt>
                <dd className="text-neutral-900">{cliente.nif_cif ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-neutral-400 text-xs">Teléfono</dt>
                <dd className="text-neutral-900">{cliente.telefono ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-neutral-400 text-xs">Tel. contacto</dt>
                <dd className="text-neutral-900">{cliente.telefono_contacto ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-neutral-400 text-xs">Tipo negocio</dt>
                <dd className="text-neutral-900">{cliente.tipo_negocio ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-neutral-400 text-xs">Registrado</dt>
                <dd className="text-neutral-900">
                  {new Date(cliente.created_at).toLocaleDateString("es-ES", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </dd>
              </div>
            </dl>
          </section>

          {/* Dirección de envío */}
          <section className="bg-white border border-neutral-100 p-5">
            <h2 className="text-xs tracking-widest uppercase text-neutral-500 mb-4">
              Dirección de envío
            </h2>
            {dir?.calle ? (
              <p className="text-sm text-neutral-700">
                {dir.calle}<br />
                {dir.cp} {dir.ciudad}{dir.provincia ? `, ${dir.provincia}` : ""}
              </p>
            ) : (
              <p className="text-sm text-neutral-400">Sin dirección registrada</p>
            )}
          </section>

          {/* Historial de pedidos */}
          <section className="bg-white border border-neutral-100 p-5">
            <h2 className="text-xs tracking-widest uppercase text-neutral-500 mb-4">
              Historial de pedidos
            </h2>
            {cliente.pedidos.length > 0 ? (
              <HistorialPedidos pedidos={cliente.pedidos} totalGastado={cliente.totalGastado} />
            ) : (
              <p className="text-sm text-neutral-400">Este cliente no ha realizado ningún pedido.</p>
            )}
          </section>
        </div>

        {/* Columna derecha: resumen rápido */}
        <div className="space-y-6">
          <section className="bg-white border border-neutral-100 p-5">
            <h2 className="text-xs tracking-widest uppercase text-neutral-500 mb-4">
              Resumen
            </h2>
            <div className="space-y-4">
              <div>
                <p className="text-3xl font-light text-neutral-900" style={{ fontFamily: "var(--font-cormorant)" }}>
                  {cliente.totalPedidos}
                </p>
                <p className="text-xs text-neutral-400">pedido{cliente.totalPedidos !== 1 ? "s" : ""}</p>
              </div>
              <div>
                <p className="text-3xl font-light text-neutral-900" style={{ fontFamily: "var(--font-cormorant)" }}>
                  {cliente.totalGastado.toFixed(2)} €
                </p>
                <p className="text-xs text-neutral-400">total gastado</p>
              </div>
              {cliente.tipo_cliente === "b2b" && (
                <div className="pt-3 border-t border-neutral-100">
                  <p className="text-xs text-neutral-400 mb-1">Descuento B2B</p>
                  <p className="text-lg font-medium text-[#7A4A40]">{cliente.descuento_b2b ?? 0}%</p>
                  <p className="text-xs text-neutral-400 mt-1">
                    {cliente.b2b_aprobado ? "✓ Aprobado" : "⏳ Pendiente de aprobación"}
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
