import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CuentaSidebar } from "@/components/layout/CuentaSidebar";
import { logout } from "@/actions/auth";
import type { ReactNode } from "react";

export default async function CuentaLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login?redirectTo=/cuenta");

  const { data: perfil } = await supabase
    .from("perfiles_usuario")
    .select("nombre_completo, tipo_cliente, b2b_aprobado")
    .eq("id", user.id)
    .single();

  const displayName = perfil?.nombre_completo?.split(" ")[0] ?? user.email?.split("@")[0] ?? "Mi cuenta";
  const esProfesional = perfil?.tipo_cliente === "b2b";
  const b2bAprobado = perfil?.b2b_aprobado === true;

  return (
    <main className="container-main py-8 lg:py-12">
      {/* Cabecera */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1
            className="text-3xl font-light text-neutral-900"
            style={{ fontFamily: "var(--font-cormorant)" }}
          >
            Mi Cuenta
          </h1>
          {esProfesional && (
            <span
              className={`inline-block mt-2 text-xs px-2.5 py-1 font-medium ${
                b2bAprobado
                  ? "bg-[#C4857A]/10 text-[#7A4A40]"
                  : "bg-amber-50 text-amber-700"
              }`}
            >
              {b2bAprobado ? "Profesional verificado" : "Profesional pendiente"}
            </span>
          )}
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

      {/* Layout con sidebar */}
      <div className="flex flex-col lg:flex-row gap-8">
        <CuentaSidebar
          userName={displayName}
          userEmail={user.email ?? ""}
        />
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </main>
  );
}
