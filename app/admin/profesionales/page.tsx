import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import ProfesionalAcciones from "@/components/admin/ProfesionalAcciones";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Profesionales B2B | Admin",
  robots: { index: false, follow: false },
};

export default async function AdminProfesionalesPage() {
  const supabase = createAdminClient();

  // Obtener todos los usuarios con tipo_cliente = b2b
  const { data: profesionales } = await supabase
    .from("perfiles_usuario")
    .select("id, nombre_completo, empresa, nif_cif, telefono, b2b_aprobado, created_at")
    .eq("tipo_cliente", "b2b")
    .order("created_at", { ascending: false });

  // Obtener emails desde auth.users via admin API
  const perfilesConEmail: Array<{
    id: string;
    nombre_completo: string | null;
    empresa: string | null;
    nif_cif: string | null;
    telefono: string | null;
    b2b_aprobado: boolean;
    created_at: string;
    email: string;
  }> = [];

  for (const perfil of profesionales ?? []) {
    const { data: { user } } = await supabase.auth.admin.getUserById(perfil.id);
    perfilesConEmail.push({
      ...perfil,
      email: user?.email ?? "(sin email)",
    });
  }

  const pendientes = perfilesConEmail.filter((p) => !p.b2b_aprobado);
  const aprobados  = perfilesConEmail.filter((p) => p.b2b_aprobado);

  return (
    <div>
      <h1
        className="text-2xl font-light text-neutral-900 mb-2"
        style={{ fontFamily: "var(--font-cormorant)" }}
      >
        Cuentas Profesionales B2B
      </h1>
      <p className="text-sm text-neutral-500 mb-8">
        {pendientes.length} pendientes · {aprobados.length} aprobadas
      </p>

      {/* Pendientes */}
      {pendientes.length > 0 && (
        <section className="mb-10">
          <h2 className="text-xs tracking-widest uppercase text-amber-700 mb-4 flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-amber-500" />
            Pendientes de aprobación ({pendientes.length})
          </h2>
          <div className="bg-white border border-neutral-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-100 bg-neutral-50">
                  <th className="text-left text-xs tracking-wider uppercase text-neutral-500 px-4 py-3 font-normal">Nombre</th>
                  <th className="text-left text-xs tracking-wider uppercase text-neutral-500 px-4 py-3 font-normal">Email</th>
                  <th className="text-left text-xs tracking-wider uppercase text-neutral-500 px-4 py-3 font-normal">Empresa</th>
                  <th className="text-left text-xs tracking-wider uppercase text-neutral-500 px-4 py-3 font-normal">NIF/CIF</th>
                  <th className="text-left text-xs tracking-wider uppercase text-neutral-500 px-4 py-3 font-normal">Teléfono</th>
                  <th className="text-left text-xs tracking-wider uppercase text-neutral-500 px-4 py-3 font-normal">Fecha</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                {pendientes.map((p) => (
                  <tr key={p.id} className="hover:bg-amber-50/30 transition-colors">
                    <td className="px-4 py-3 text-neutral-900">{p.nombre_completo ?? "—"}</td>
                    <td className="px-4 py-3 text-neutral-600">{p.email}</td>
                    <td className="px-4 py-3 text-neutral-700 font-medium">{p.empresa ?? "—"}</td>
                    <td className="px-4 py-3 text-neutral-600">{p.nif_cif ?? "—"}</td>
                    <td className="px-4 py-3 text-neutral-600">{p.telefono ?? "—"}</td>
                    <td className="px-4 py-3 text-neutral-500 whitespace-nowrap">
                      {new Date(p.created_at).toLocaleDateString("es-ES")}
                    </td>
                    <td className="px-4 py-3">
                      <ProfesionalAcciones userId={p.id} b2bAprobado={false} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {pendientes.length === 0 && (
        <div className="mb-10 p-6 bg-green-50 border border-green-200 text-green-800 text-sm">
          No hay solicitudes pendientes de aprobación.
        </div>
      )}

      {/* Aprobadas */}
      {aprobados.length > 0 && (
        <section>
          <h2 className="text-xs tracking-widest uppercase text-green-700 mb-4 flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
            Cuentas aprobadas ({aprobados.length})
          </h2>
          <div className="bg-white border border-neutral-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-100 bg-neutral-50">
                  <th className="text-left text-xs tracking-wider uppercase text-neutral-500 px-4 py-3 font-normal">Nombre</th>
                  <th className="text-left text-xs tracking-wider uppercase text-neutral-500 px-4 py-3 font-normal">Email</th>
                  <th className="text-left text-xs tracking-wider uppercase text-neutral-500 px-4 py-3 font-normal">Empresa</th>
                  <th className="text-left text-xs tracking-wider uppercase text-neutral-500 px-4 py-3 font-normal">NIF/CIF</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                {aprobados.map((p) => (
                  <tr key={p.id} className="hover:bg-neutral-50 transition-colors">
                    <td className="px-4 py-3 text-neutral-900">{p.nombre_completo ?? "—"}</td>
                    <td className="px-4 py-3 text-neutral-600">{p.email}</td>
                    <td className="px-4 py-3 text-neutral-700 font-medium">{p.empresa ?? "—"}</td>
                    <td className="px-4 py-3 text-neutral-600">{p.nif_cif ?? "—"}</td>
                    <td className="px-4 py-3">
                      <ProfesionalAcciones userId={p.id} b2bAprobado={true} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
