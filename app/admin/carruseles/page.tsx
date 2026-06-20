import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { CarruselesAdmin } from "./CarruselesAdmin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Carruseles | Admin",
  robots: { index: false, follow: false },
};

export default async function AdminCarruselesPage() {
  const supabase = createAdminClient();

  const { data: carruseles } = await supabase
    .from("carruseles")
    .select(`
      id, nombre, subtitulo, activo, orden,
      productos:carrusel_productos(
        orden,
        producto:productos_padre(id, nombre, imagen_principal_url, marca:marcas(nombre))
      )
    `)
    .order("orden");

  return (
    <div className="container-main py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-light text-neutral-900" style={{ fontFamily: "var(--font-cormorant)" }}>
          Carruseles de la home
        </h1>
        <p className="text-sm text-neutral-500 mt-1">
          Crea y edita carruseles personalizados que aparecen en la página de inicio.
        </p>
      </div>
      <CarruselesAdmin carruselesIniciales={(carruseles ?? []).map((c) => ({
        ...c,
        productos: (c.productos ?? []).map((r: { orden: number; producto: unknown }) => ({
          orden: r.orden,
          producto: Array.isArray(r.producto) ? (r.producto[0] ?? null) : r.producto,
        })),
      }))} />
    </div>
  );
}
