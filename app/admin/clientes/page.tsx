import type { Metadata } from "next";
import { buscarClientes } from "@/actions/clientes";
import ClientesListaClient from "./clientes-lista-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Clientes | Admin",
  robots: { index: false, follow: false },
};

export default async function AdminClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; pagina?: string; filtro?: string }>;
}) {
  const sp = await searchParams;
  const busqueda = sp.q ?? "";
  const pagina = Number(sp.pagina ?? 1);
  const filtro = (sp.filtro as "todos" | "b2b" | "b2c") ?? "todos";

  const { clientes, total, error } = await buscarClientes(busqueda, pagina, 20, filtro);
  const totalPaginas = Math.ceil(total / 20);

  return (
    <div>
      <h1
        className="text-2xl font-light text-neutral-900 mb-2"
        style={{ fontFamily: "var(--font-cormorant)" }}
      >
        Clientes
      </h1>
      <p className="text-sm text-neutral-500 mb-6">
        {total} cliente{total !== 1 ? "s" : ""}{filtro !== "todos" ? ` (${filtro.toUpperCase()})` : ""}
      </p>

      <ClientesListaClient
        clientes={clientes}
        total={total}
        totalPaginas={totalPaginas}
        paginaActual={pagina}
        busqueda={busqueda}
        filtro={filtro}
      />
    </div>
  );
}
