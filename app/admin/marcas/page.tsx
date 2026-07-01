import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { MarcasAdmin } from "./MarcasAdmin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Marcas | Admin",
  robots: { index: false, follow: false },
};

export default async function AdminMarcasPage() {
  const supa = createAdminClient();
  const { data: marcas } = await supa
    .from("marcas")
    .select("id, nombre, slug, logo_url, activa")
    .order("nombre");

  return (
    <div className="max-w-4xl">
      <MarcasAdmin marcas={marcas ?? []} />
    </div>
  );
}
