import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Clientes | Admin",
  robots: { index: false, follow: false },
};

export default async function AdminClientesPage() {
  const supabase = createAdminClient();

  // Obtener todos los usuarios registrados
  const { data: perfiles } = await supabase
    .from("perfiles_usuario")
    .select("id, nombre_completo, empresa, nif_cif, telefono, telefono_contacto, tipo_cliente, b2b_aprobado, descuento_b2b, direccion_envio, created_at")
    .order("created_at", { ascending: false });

  // Enriquecer con emails desde auth
  const clientes: Array<{
    id: string;
    email: string;
    nombre_completo: string | null;
    empresa: string | null;
    nif_cif: string | null;
    telefono: string | null;
    telefono_contacto: string | null;
    tipo_cliente: string;
    b2b_aprobado: boolean;
    descuento_b2b: number;
    direccion_envio: { calle: string; cp: string; ciudad: string; provincia: string } | null;
    created_at: string;
  }> = [];

  for (const p of perfiles ?? []) {
    const { data: { user } } = await supabase.auth.admin.getUserById(p.id);
    clientes.push({ ...p, email: user?.email ?? "(sin email)" });
  }

  // También obtener emails de pedidos que no tienen perfil
  const { data: pedidosSinPerfil } = await supabase
    .from("pedidos")
    .select("email_cliente")
    .is("usuario_id", null);

  const emailsSinPerfil = [...new Set((pedidosSinPerfil ?? []).map(p => p.email_cliente))];

  const b2b = clientes.filter(c => c.tipo_cliente === "b2b");
  const b2c = clientes.filter(c => c.tipo_cliente !== "b2b");

  return (
    <div>
      <h1
        className="text-2xl font-light text-neutral-900 mb-2"
        style={{ fontFamily: "var(--font-cormorant)" }}
      >
        Clientes
      </h1>
      <p className="text-sm text-neutral-500 mb-8">
        {clientes.length} registrados · {emailsSinPerfil.length} compraron sin cuenta
      </p>

      {/* Clientes registrados */}
      <section className="mb-10">
        <h2 className="text-xs tracking-widest uppercase text-neutral-500 mb-4">
          Usuarios registrados ({clientes.length})
        </h2>
        <div className="bg-white border border-neutral-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-100 bg-neutral-50">
                <th className="text-left text-xs tracking-wider uppercase text-neutral-500 px-4 py-3 font-normal">Nombre</th>
                <th className="text-left text-xs tracking-wider uppercase text-neutral-500 px-4 py-3 font-normal">Email</th>
                <th className="text-left text-xs tracking-wider uppercase text-neutral-500 px-4 py-3 font-normal">Tipo</th>
                <th className="text-left text-xs tracking-wider uppercase text-neutral-500 px-4 py-3 font-normal">NIF/CIF</th>
                <th className="text-left text-xs tracking-wider uppercase text-neutral-500 px-4 py-3 font-normal">Dirección</th>
                <th className="text-left text-xs tracking-wider uppercase text-neutral-500 px-4 py-3 font-normal">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-50">
              {clientes.map((c) => (
                <tr key={c.id} className="hover:bg-neutral-50 transition-colors">
                  <td className="px-4 py-3 text-neutral-900">{c.nombre_completo ?? c.empresa ?? "—"}</td>
                  <td className="px-4 py-3 text-neutral-600">{c.email}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] tracking-wider uppercase px-2 py-0.5 rounded ${
                      c.tipo_cliente === "b2b"
                        ? "bg-[#C4857A]/10 text-[#7A4A40]"
                        : "bg-neutral-100 text-neutral-500"
                    }`}>
                      {c.tipo_cliente === "b2b" ? "Profesional" : "Particular"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-neutral-600">{c.nif_cif ?? "—"}</td>
                  <td className="px-4 py-3 text-neutral-500 text-xs">
                    {c.direccion_envio
                      ? `${c.direccion_envio.calle}, ${c.direccion_envio.cp} ${c.direccion_envio.ciudad}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-neutral-500 whitespace-nowrap">
                    {new Date(c.created_at).toLocaleDateString("es-ES")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Emails sin cuenta */}
      {emailsSinPerfil.length > 0 && (
        <section>
          <h2 className="text-xs tracking-widest uppercase text-neutral-500 mb-4">
            Compraron sin cuenta ({emailsSinPerfil.length})
          </h2>
          <div className="bg-white border border-neutral-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-100 bg-neutral-50">
                  <th className="text-left text-xs tracking-wider uppercase text-neutral-500 px-4 py-3 font-normal">Email</th>
                  <th className="text-right text-xs tracking-wider uppercase text-neutral-500 px-4 py-3 font-normal">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                {emailsSinPerfil.map((email) => (
                  <tr key={email} className="hover:bg-neutral-50 transition-colors">
                    <td className="px-4 py-3 text-neutral-600">{email}</td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/facturas`}
                        className="text-xs px-3 py-1.5 border border-neutral-200 rounded hover:bg-neutral-100 transition-colors"
                      >
                        Generar factura
                      </Link>
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
