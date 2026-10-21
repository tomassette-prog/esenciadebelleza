import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { RestaurarCarrito } from "@/components/carrito/RestaurarCarrito";

export const dynamic = "force-dynamic";

const CADUCIDAD_DIAS = 30;

export default async function RecuperarCarritoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data: carrito } = await supabase
    .from("carritos_abandonados")
    .select("id, items, created_at")
    .eq("id", id)
    .maybeSingle();

  const caducado =
    !carrito ||
    Date.now() - new Date(carrito.created_at).getTime() > CADUCIDAD_DIAS * 24 * 60 * 60 * 1000;

  if (caducado) redirect("/");

  return <RestaurarCarrito items={(carrito.items ?? []) as never} />;
}
