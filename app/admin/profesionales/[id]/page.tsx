import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { obtenerDetalleProfesional } from "@/actions/profesionales";
import { listarFacturasProfesional } from "@/actions/facturas";
import ProfesionalAcciones from "@/components/admin/ProfesionalAcciones";
import FacturasProfesional from "@/components/admin/FacturasProfesional";
import { HistorialPedidos } from "@/components/admin/HistorialPedidos";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Detalle Profesional | Admin",
  robots: { index: false, follow: false },
};

export default async function DetalleProfesionalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { profesional, error } = await obtenerDetalleProfesional(id);

  if (error || !profesional) notFound();

  const dir = profesional.direccion_envio as { calle?: string; cp?: string; ciudad?: string; provincia?: string } | null;
  const facturas = await listarFacturasProfesional(id);
  const nombre = profesional.empresa ?? profesional.nombre_completo ?? profesional.email;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <Link
          href="/admin/profesionales"
          className="text-xs text-neutral-500 hover:text-neutral-900 transition-colors"
        >
          ← Volver a profesionales
        </Link>
      </div>

      <div className="flex items-start justify-between mb-8">
        <div>
          <h1
            className="text-2xl font-light text-neutral-900 mb-1"
            style={{ fontFamily: "var(--font-cormorant)" }}
          >
            {profesional.nombre_completo ?? profesional.empresa ?? "Sin nombre"}
          </h1>
          <p className="text-sm text-neutral-500">
            {profesional.email}
            {profesional.empresa && profesional.nombre_completo && (
              <span className="ml-2 text-neutral-400">· {profesional.empresa}</span>
            )}
          </p>
        </div>
        <span className={`inline-flex items-center gap-1 text-[10px] tracking-wider uppercase px-3 py-1 rounded ${
          profesional.b2b_aprobado
            ? "bg-green-100 text-green-800"
            : "bg-amber-100 text-amber-800"
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${
            profesional.b2b_aprobado ? "bg-green-500" : "bg-amber-500"
          }`} />
          {profesional.b2b_aprobado ? "Aprobado" : "Pendiente"}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna izquierda: datos + pedidos + facturas */}
        <div className="lg:col-span-2 space-y-6">
          {/* Datos del profesional */}
          <section className="bg-white border border-neutral-100 p-5">
            <h2 className="text-xs tracking-widest uppercase text-neutral-500 mb-4">
              Datos del profesional
            </h2>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div>
                <dt className="text-neutral-400 text-xs">Nombre</dt>
                <dd className="text-neutral-900">{profesional.nombre_completo ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-neutral-400 text-xs">Email</dt>
                <dd className="text-neutral-900">{profesional.email}</dd>
              </div>
              <div>
                <dt className="text-neutral-400 text-xs">Empresa</dt>
                <dd className="text-neutral-900 font-medium">{profesional.empresa ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-neutral-400 text-xs">NIF/CIF</dt>
                <dd className="text-neutral-900">{profesional.nif_cif ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-neutral-400 text-xs">Tipo negocio</dt>
                <dd className="text-neutral-900">{profesional.tipo_negocio ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-neutral-400 text-xs">Teléfono</dt>
                <dd className="text-neutral-900">{profesional.telefono ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-neutral-400 text-xs">Tel. contacto</dt>
                <dd className="text-neutral-900">{profesional.telefono_contacto ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-neutral-400 text-xs">Registrado</dt>
                <dd className="text-neutral-900">
                  {new Date(profesional.created_at).toLocaleDateString("es-ES", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </dd>
              </div>
            </dl>
          </section>

          {/* Dirección */}
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
            {profesional.pedidos.length > 0 ? (
              <HistorialPedidos pedidos={profesional.pedidos} totalGastado={profesional.totalGastado} />
            ) : (
              <p className="text-sm text-neutral-400">Este profesional no ha realizado ningún pedido.</p>
            )}
          </section>

          {/* Facturas */}
          <section className="bg-white border border-neutral-100 p-5">
            <FacturasProfesional
              profesionalId={id}
              profesionalNombre={nombre}
              facturasIniciales={facturas}
            />
          </section>
        </div>

        {/* Columna derecha: resumen + acciones */}
        <div className="space-y-6">
          {/* Resumen */}
          <section className="bg-white border border-neutral-100 p-5">
            <h2 className="text-xs tracking-widest uppercase text-neutral-500 mb-4">
              Resumen
            </h2>
            <div className="space-y-4">
              <div>
                <p className="text-3xl font-light text-neutral-900" style={{ fontFamily: "var(--font-cormorant)" }}>
                  {profesional.totalPedidos}
                </p>
                <p className="text-xs text-neutral-400">pedido{profesional.totalPedidos !== 1 ? "s" : ""}</p>
              </div>
              <div>
                <p className="text-3xl font-light text-neutral-900" style={{ fontFamily: "var(--font-cormorant)" }}>
                  {profesional.totalGastado.toFixed(2)} €
                </p>
                <p className="text-xs text-neutral-400">total facturado</p>
              </div>
              <div className="pt-3 border-t border-neutral-100">
                <p className="text-xs text-neutral-400 mb-1">Descuento B2B</p>
                <p className="text-lg font-medium text-[#7A4A40]">{profesional.descuento_b2b ?? 0}%</p>
              </div>
            </div>
          </section>

          {/* Acciones de aprobación */}
          <section className="bg-white border border-neutral-100 p-5">
            <h2 className="text-xs tracking-widest uppercase text-neutral-500 mb-4">
              Gestión
            </h2>
            <ProfesionalAcciones
              userId={id}
              b2bAprobado={profesional.b2b_aprobado}
              descuentoB2b={profesional.descuento_b2b ?? 0}
            />
          </section>
        </div>
      </div>
    </div>
  );
}
