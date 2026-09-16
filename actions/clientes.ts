"use server";

import { createAdminClient } from "@/lib/supabase/admin";

// ── Detalle de un cliente (perfil + pedidos) ─────────────────────────────────
export async function obtenerDetalleCliente(userId: string) {
  const supabase = createAdminClient();

  // 1. Perfil
  const { data: perfil, error: perfilError } = await supabase
    .from("perfiles_usuario")
    .select("*")
    .eq("id", userId)
    .single();

  if (perfilError || !perfil) return { cliente: null, error: perfilError?.message ?? "Perfil no encontrado" };

  // 2. Email desde auth
  const { data: { user } } = await supabase.auth.admin.getUserById(userId);
  const email = user?.email ?? "(sin email)";

  // 3. Pedidos del usuario (por usuario_id o por email)
  const { data: pedidosPorId } = await supabase
    .from("pedidos")
    .select("id, estado, total, metodo_pago, tipo_precio, created_at")
    .eq("usuario_id", userId)
    .order("created_at", { ascending: false });

  const { data: pedidosPorEmail } = await supabase
    .from("pedidos")
    .select("id, estado, total, metodo_pago, tipo_precio, created_at")
    .eq("email_cliente", email)
    .is("usuario_id", null)
    .order("created_at", { ascending: false });

  // Merge y deduplicar
  const todosPedidos = [...(pedidosPorId ?? []), ...(pedidosPorEmail ?? [])];
  const pedidosMap = new Map<string, (typeof todosPedidos)[number]>();
  for (const p of todosPedidos) {
    pedidosMap.set(p.id, p);
  }
  const pedidos = [...pedidosMap.values()].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const totalGastado = pedidos.reduce((sum, p) => sum + (p.total ?? 0), 0);

  return {
    cliente: {
      ...perfil,
      email,
      pedidos,
      totalGastado,
      totalPedidos: pedidos.length,
    },
    error: null,
  };
}

// ── Buscar clientes (para la lista con paginación) ───────────────────────────
export async function buscarClientes(
  busqueda: string = "",
  pagina: number = 1,
  porPagina: number = 20,
  filtro: "todos" | "b2b" | "b2c" = "todos"
) {
  const supabase = createAdminClient();
  const desde = (pagina - 1) * porPagina;

  let query = supabase
    .from("perfiles_usuario")
    .select("id, nombre_completo, empresa, nif_cif, telefono, tipo_cliente, b2b_aprobado, descuento_b2b, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(desde, desde + porPagina - 1);

  if (filtro === "b2b") query = query.eq("tipo_cliente", "b2b");
  else if (filtro === "b2c") query = query.neq("tipo_cliente", "b2b");

  const { data: perfiles, count, error } = await query;
  if (error) return { clientes: [], total: 0, error: error.message };

  // Enriquecer con emails
  const clientes: Array<{
    id: string;
    email: string;
    nombre_completo: string | null;
    empresa: string | null;
    nif_cif: string | null;
    telefono: string | null;
    tipo_cliente: string;
    b2b_aprobado: boolean;
    descuento_b2b: number;
    created_at: string;
  }> = [];

  for (const p of perfiles ?? []) {
    const { data: { user } } = await supabase.auth.admin.getUserById(p.id);
    const email = user?.email ?? "(sin email)";

    // Filtrado por búsqueda (en memoria, ya que auth.users no es searchable directamente)
    if (busqueda) {
      const q = busqueda.toLowerCase();
      const matches =
        email.toLowerCase().includes(q) ||
        (p.nombre_completo ?? "").toLowerCase().includes(q) ||
        (p.empresa ?? "").toLowerCase().includes(q) ||
        (p.nif_cif ?? "").toLowerCase().includes(q);
      if (!matches) continue;
    }

    clientes.push({ ...p, email });
  }

  // Si hay búsqueda, el count no es exacto (filtramos en memoria), pero es aceptable
  return { clientes, total: busqueda ? clientes.length : (count ?? 0), error: null };
}
