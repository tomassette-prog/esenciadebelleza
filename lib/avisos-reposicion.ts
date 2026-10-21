import { createClient } from "@supabase/supabase-js";
import { enviarAvisoReposicion } from "@/lib/emails-conversion";

// Dispatches restock notices. The supplier owns the stock; we only watch our
// own DB (kept fresh by the nightly sync and the WooCommerce webhook) and
// notify the customers who asked to be told when units come back.

export function clienteServiceRole() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

const LOTE_MAXIMO = 50;

export async function despacharAvisosReposicion(
  supabase: ReturnType<typeof clienteServiceRole>,
  productoIds?: string[]
): Promise<number> {
  let query = supabase
    .from("avisos_reposicion")
    .select("id, producto_id, email, productos_padre!inner(id, nombre, slug, categoria, subcategoria, activo, imagen_principal_url, variaciones:productos_variaciones(precio_b2c, activa, stock))")
    .is("notificado_at", null)
    .limit(LOTE_MAXIMO);
  if (productoIds?.length) query = query.in("producto_id", productoIds);

  const { data: avisos, error } = await query;
  if (error || !avisos?.length) return 0;

  let enviados = 0;
  type ProdAviso = {
    id: string; nombre: string; slug: string; categoria: string; subcategoria: string | null;
    activo: boolean;
    variaciones: Array<{ precio_b2c: number; activa: boolean; stock: number }>;
  };
  for (const aviso of (avisos ?? []) as unknown as Array<{
    id: string;
    email: string;
    productos_padre: ProdAviso | ProdAviso[] | null;
  }>) {
    // El embed muchos-a-uno puede llegar como objeto o como array
    const prod = Array.isArray(aviso.productos_padre) ? aviso.productos_padre[0] : aviso.productos_padre;
    const disponible = !!prod && prod.activo &&
      prod.variaciones.some((v) => v.activa && v.stock > 0);
    if (!disponible || !prod) continue;

    const precio = Math.min(
      ...prod.variaciones.filter((v) => v.activa && v.stock > 0).map((v) => v.precio_b2c)
    );
    const url = `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://esenciadebelleza.es"}/productos/${prod.categoria}/${prod.subcategoria ?? "general"}/${prod.slug}`;

    try {
      await enviarAvisoReposicion({ email: aviso.email, nombre: prod.nombre, urlProducto: url, precio });
      await supabase.from("avisos_reposicion").update({ notificado_at: new Date().toISOString() }).eq("id", aviso.id);
      enviados++;
    } catch (e) {
      console.error("[avisos] error enviando aviso", aviso.id, (e as Error).message);
    }
  }
  return enviados;
}
