import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { leerTokenResena } from "@/lib/resena-token";
import { FormularioResenaToken } from "@/components/producto/FormularioResenaToken";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Deja tu reseña",
  robots: { index: false, follow: false },
};

export default async function ResenaTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const datos = leerTokenResena(token);
  if (!datos) notFound();

  const supabase = createAdminClient();
  const { data: producto } = await supabase
    .from("productos_padre")
    .select("id, nombre")
    .eq("id", datos.productoId)
    .maybeSingle();
  if (!producto) notFound();

  return (
    <main className="container-main py-10 lg:py-14 max-w-xl">
      <h1
        className="text-3xl font-light text-neutral-900 mb-2"
        style={{ fontFamily: "var(--font-cormorant)" }}
      >
        ¿Qué te ha parecido?
      </h1>
      <p className="text-sm text-neutral-500 mb-8">
        Tu opinión como cliente es la mejor ayuda para otras personas.
      </p>
      <FormularioResenaToken
        token={token}
        email={datos.email}
        productoId={datos.productoId}
        pedidoId={datos.pedidoId}
        nombreProducto={producto.nombre}
      />
    </main>
  );
}
