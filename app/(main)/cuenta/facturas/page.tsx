import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listarMisFacturas } from "@/actions/facturas";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mis Facturas | Esencia de Belleza",
  robots: { index: false, follow: false },
};

export default async function FacturasPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirectTo=/cuenta/facturas");

  const { data: perfil } = await supabase
    .from("perfiles_usuario")
    .select("tipo_cliente, b2b_aprobado")
    .eq("id", user.id)
    .single();

  if (perfil?.tipo_cliente !== "b2b" || !perfil?.b2b_aprobado) {
    redirect("/cuenta");
  }

  const facturas = await listarMisFacturas();

  function formatBytes(bytes: number | null) {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  }

  return (
    <main className="container-main py-12">
      <div className="mb-8">
        <a href="/cuenta" className="text-xs text-neutral-400 hover:text-neutral-700 transition-colors">
          ← Volver a mi cuenta
        </a>
        <h1
          className="text-3xl font-light text-neutral-900 mt-4"
          style={{ fontFamily: "var(--font-cormorant)" }}
        >
          Mis Facturas
        </h1>
        <p className="text-sm text-neutral-500 mt-1">
          Descarga tus facturas emitidas por Esencia de Belleza.
        </p>
      </div>

      {facturas.length === 0 ? (
        <div className="bg-neutral-50 border border-neutral-100 p-8 text-center">
          <p className="text-neutral-500 text-sm">Todavía no tienes facturas disponibles.</p>
        </div>
      ) : (
        <div className="bg-white border border-neutral-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-100 bg-neutral-50">
                <th className="text-left text-xs tracking-wider uppercase text-neutral-500 px-5 py-3 font-normal">
                  Factura
                </th>
                <th className="text-left text-xs tracking-wider uppercase text-neutral-500 px-5 py-3 font-normal">
                  Fecha
                </th>
                <th className="text-left text-xs tracking-wider uppercase text-neutral-500 px-5 py-3 font-normal">
                  Tamaño
                </th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {facturas.map((f) => (
                <tr key={f.id} className="hover:bg-neutral-50 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <svg className="w-5 h-5 text-neutral-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                          d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                      </svg>
                      <span className="font-medium text-neutral-900">{f.nombre}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-neutral-600">
                    {new Date(f.created_at).toLocaleDateString("es-ES", {
                      day: "numeric", month: "long", year: "numeric",
                    })}
                  </td>
                  <td className="px-5 py-4 text-neutral-400 text-xs">
                    {formatBytes(f.archivo_size)}
                  </td>
                  <td className="px-5 py-4 text-right">
                    {f.url && (
                      <a
                        href={f.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-xs tracking-wider uppercase text-neutral-900 hover:text-[#C4857A] transition-colors font-medium"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                            d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                        </svg>
                        Descargar
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
