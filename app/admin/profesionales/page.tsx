import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import ProfesionalesListaClient from "./profesionales-lista-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Profesionales B2B | Admin",
  robots: { index: false, follow: false },
};

export default async function AdminProfesionalesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; pagina?: string; filtro?: string }>;
}) {
  const sp = await searchParams;
  const busqueda = sp.q ?? "";
  const pagina = Number(sp.pagina ?? 1);
  const filtro = (sp.filtro as "todos" | "pendientes" | "aprobados") ?? "todos";
  const porPagina = 20;
  const supabase = createAdminClient();

  // Obtener todos los B2B (la tabla es pequeña, filtramos en memoria para búsqueda por email)
  const { data: profesionales } = await supabase
    .from("perfiles_usuario")
    .select("id, nombre_completo, empresa, nif_cif, telefono, telefono_contacto, tipo_negocio, direccion_envio, b2b_aprobado, descuento_b2b, created_at")
    .eq("tipo_cliente", "b2b")
    .order("created_at", { ascending: false });

  type Profesional = {
    id: string;
    nombre_completo: string | null;
    empresa: string | null;
    nif_cif: string | null;
    telefono: string | null;
    telefono_contacto: string | null;
    tipo_negocio: string | null;
    direccion_envio: { calle: string; cp: string; ciudad: string; provincia: string } | null;
    b2b_aprobado: boolean;
    descuento_b2b: number;
    created_at: string;
    email: string;
  };

  const perfilesConEmail: Profesional[] = [];

  for (const perfil of profesionales ?? []) {
    const { data: { user } } = await supabase.auth.admin.getUserById(perfil.id);
    perfilesConEmail.push({
      ...perfil,
      email: user?.email ?? "(sin email)",
    });
  }

  // Filtrar por búsqueda
  let filtrados = perfilesConEmail;
  if (busqueda) {
    const q = busqueda.toLowerCase();
    filtrados = perfilesConEmail.filter((p) =>
      p.email.toLowerCase().includes(q) ||
      (p.nombre_completo ?? "").toLowerCase().includes(q) ||
      (p.empresa ?? "").toLowerCase().includes(q) ||
      (p.nif_cif ?? "").toLowerCase().includes(q)
    );
  }

  if (filtro === "pendientes") filtrados = filtrados.filter((p) => !p.b2b_aprobado);
  else if (filtro === "aprobados") filtrados = filtrados.filter((p) => p.b2b_aprobado);

  // Paginación en memoria
  const total = filtrados.length;
  const totalPaginas = Math.ceil(total / porPagina);
  const desde = (pagina - 1) * porPagina;
  const paginaActual = filtrados.slice(desde, desde + porPagina);

  const pendientesCount = perfilesConEmail.filter((p) => !p.b2b_aprobado).length;
  const aprobadosCount = perfilesConEmail.filter((p) => p.b2b_aprobado).length;

  return (
    <div>
      <h1
        className="text-2xl font-light text-neutral-900 mb-2"
        style={{ fontFamily: "var(--font-cormorant)" }}
      >
        Cuentas Profesionales B2B
      </h1>
      <p className="text-sm text-neutral-500 mb-6">
        {pendientesCount} pendientes · {aprobadosCount} aprobadas
      </p>

      <ProfesionalesListaClient
        profesionales={paginaActual}
        total={total}
        totalPaginas={totalPaginas}
        paginaActual={pagina}
        busqueda={busqueda}
        filtro={filtro}
        pendientesCount={pendientesCount}
      />
    </div>
  );
}
