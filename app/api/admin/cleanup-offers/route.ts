import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verificarAdmin } from "@/lib/admin-auth";

export async function POST() {
  try { await verificarAdmin(); } catch {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const supa = createAdminClient();

  const { data: productos } = await supa
    .from("productos_padre")
    .select("id, variaciones:productos_variaciones!inner(precio_comparar, activa)")
    .eq("oferta", true)
    .eq("activo", true);

  if (!productos) return NextResponse.json({ limpiados: 0 });

  let limpiados = 0;
  for (const p of productos) {
    const vars = (p.variaciones as { precio_comparar: number | null; activa: boolean }[])?.filter(v => v.activa) ?? [];
    if (!vars.some(v => v.precio_comparar != null && v.precio_comparar > 0)) {
      await supa.from("productos_padre").update({ oferta: false }).eq("id", p.id);
      limpiados++;
    }
  }
  return NextResponse.json({ limpiados });
}
