"use server";

import { createAdminClient } from "@/lib/supabase/admin";

interface ClienteFila {
  id: string;
  email: string;
  nombre_completo: string | null;
  empresa: string | null;
  nif_cif: string | null;
  telefono: string | null;
  tipo_cliente: string;
  b2b_aprobado: boolean;
  descuento_b2b: number;
  usuario_id: string | null;
  created_at: string;
}

// Enriquece filas de `clientes` con los datos B2B que viven en perfiles_usuario
// (fuente de verdad para aprobación/descuento de profesionales).
async function enriquecerConPerfil(
  supabase: ReturnType<typeof createAdminClient>,
  filas: Array<{ usuario_id: string | null; tipo_cliente: string }>
): Promise<Map<string, { tipo_cliente: string; b2b_aprobado: boolean; descuento_b2b: number }>> {
  const ids = [...new Set(filas.map((f) => f.usuario_id).filter((v): v is string => !!v))];
  const perfiles = new Map<string, { tipo_cliente: string; b2b_aprobado: boolean; descuento_b2b: number }>();
  if (ids.length) {
    const { data } = await supabase
      .from("perfiles_usuario")
      .select("id, tipo_cliente, b2b_aprobado, descuento_b2b")
      .in("id", ids);
    for (const p of data ?? []) {
      perfiles.set(p.id, {
        tipo_cliente: p.tipo_cliente ?? "b2c",
        b2b_aprobado: p.b2b_aprobado === true,
        descuento_b2b: p.descuento_b2b ?? 0,
      });
    }
  }
  return perfiles;
}

// ── Detalle de un cliente (por id de `clientes` o, en su defecto, de auth) ────
export async function obtenerDetalleCliente(id: string) {
  const supabase = createAdminClient();

  // 1. Cliente desde el registro de clientes (creado por el trigger de pedidos)
  const { data: cliente } = await supabase
    .from("clientes")
    .select("*")
    .eq("id", id)
    .single();

  if (!cliente) return obtenerDetalleClienteLegacy(id);

  // 2. Datos B2B que viven en perfiles_usuario (aprobación, descuento, contacto)
  let extras: Record<string, unknown> = {
    b2b_aprobado: false,
    descuento_b2b: 0,
  };
  if (cliente.usuario_id) {
    const { data: perfil } = await supabase
      .from("perfiles_usuario")
      .select("tipo_cliente, b2b_aprobado, descuento_b2b, telefono_contacto, tipo_negocio")
      .eq("id", cliente.usuario_id)
      .single();
    if (perfil) {
      extras = {
        tipo_cliente: perfil.tipo_cliente ?? cliente.tipo_cliente,
        b2b_aprobado: perfil.b2b_aprobado === true,
        descuento_b2b: perfil.descuento_b2b ?? 0,
        telefono_contacto: perfil.telefono_contacto ?? null,
        tipo_negocio: perfil.tipo_negocio ?? null,
      };
    }
  }

  // 3. Pedidos (por email —da igual que sean de invitado— y por usuario)
  const pedidos = await pedidosDeCliente(supabase, cliente.email, cliente.usuario_id);
  const totalGastado = pedidos.reduce((sum, p) => sum + (p.total ?? 0), 0);

  return {
    cliente: {
      ...cliente,
      ...extras,
      pedidos,
      totalGastado,
      totalPedidos: pedidos.length,
    },
    error: null,
  };
}

// Pedidos de un cliente, mergeados por email y por usuario (sin duplicados)
async function pedidosDeCliente(
  supabase: ReturnType<typeof createAdminClient>,
  email: string,
  usuarioId: string | null
) {
  const cols = "id, estado, total, metodo_pago, tipo_precio, created_at";

  const { data: porEmail } = await supabase
    .from("pedidos")
    .select(cols)
    .ilike("email_cliente", email)
    .order("created_at", { ascending: false });

  let porId: typeof porEmail = null;
  if (usuarioId) {
    const { data } = await supabase
      .from("pedidos")
      .select(cols)
      .eq("usuario_id", usuarioId)
      .order("created_at", { ascending: false });
    porId = data;
  }

  const mapa = new Map<string, NonNullable<typeof porEmail>[number]>();
  for (const p of [...(porEmail ?? []), ...(porId ?? [])]) mapa.set(p.id, p);
  return [...mapa.values()].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

// Fallback: ids antiguos apuntaban al usuario de auth (o la tabla `clientes`
// aún no está creada en la BD) — comportamiento previo sin regresión.
async function obtenerDetalleClienteLegacy(userId: string) {
  const supabase = createAdminClient();

  const { data: perfil, error: perfilError } = await supabase
    .from("perfiles_usuario")
    .select("*")
    .eq("id", userId)
    .single();

  if (perfilError || !perfil) return { cliente: null, error: perfilError?.message ?? "Perfil no encontrado" };

  const { data: { user } } = await supabase.auth.admin.getUserById(userId);
  const email = user?.email ?? "(sin email)";
  const pedidos = await pedidosDeCliente(supabase, email, userId);

  return {
    cliente: {
      ...perfil,
      email,
      usuario_id: userId,
      b2b_aprobado: perfil.b2b_aprobado === true,
      descuento_b2b: perfil.descuento_b2b ?? 0,
      pedidos,
      totalGastado: pedidos.reduce((sum, p) => sum + (p.total ?? 0), 0),
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
  // Sanitizar: los comodines/comas de PostgREST .or() rompen la sintaxis
  const q = busqueda.trim().replace(/[%_,()]/g, " ").trim();

  let query = supabase
    .from("clientes")
    .select(
      "id, email, nombre_completo, empresa, nif_cif, telefono, tipo_cliente, usuario_id, created_at",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(desde, desde + porPagina - 1);

  if (filtro === "b2b") query = query.eq("tipo_cliente", "b2b");
  else if (filtro === "b2c") query = query.neq("tipo_cliente", "b2b");
  if (q) {
    query = query.or(
      `email.ilike.%${q}%,nombre_completo.ilike.%${q}%,empresa.ilike.%${q}%,nif_cif.ilike.%${q}%,telefono.ilike.%${q}%`
    );
  }

  const { data: filas, count, error } = await query;
  if (error) return buscarClientesLegacy(busqueda, pagina, porPagina, filtro);

  // perfiles_usuario es la fuente de verdad para B2B (aprobación/descuento)
  const perfiles = await enriquecerConPerfil(supabase, filas ?? []);

  const clientes: ClienteFila[] = (filas ?? []).map((f) => {
    const p = f.usuario_id ? perfiles.get(f.usuario_id) : undefined;
    return {
      id: f.id,
      email: f.email,
      nombre_completo: f.nombre_completo,
      empresa: f.empresa,
      nif_cif: f.nif_cif,
      telefono: f.telefono,
      tipo_cliente: p?.tipo_cliente === "b2b" ? "b2b" : f.tipo_cliente,
      b2b_aprobado: p?.b2b_aprobado ?? false,
      descuento_b2b: p?.descuento_b2b ?? 0,
      usuario_id: f.usuario_id,
      created_at: f.created_at,
    };
  });

  return { clientes, total: count ?? clientes.length, error: null };
}

// Fallback: tabla `clientes` aún no creada — comportamiento previo (perfiles)
async function buscarClientesLegacy(
  busqueda: string,
  pagina: number,
  porPagina: number,
  filtro: "todos" | "b2b" | "b2c"
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

  const clientes: ClienteFila[] = [];

  for (const p of perfiles ?? []) {
    const { data: { user } } = await supabase.auth.admin.getUserById(p.id);
    const email = user?.email ?? "(sin email)";

    // Filtrado por búsqueda (en memoria, ya que auth.users no es searchable directamente)
    if (busqueda) {
      const s = busqueda.toLowerCase();
      const matches =
        email.toLowerCase().includes(s) ||
        (p.nombre_completo ?? "").toLowerCase().includes(s) ||
        (p.empresa ?? "").toLowerCase().includes(s) ||
        (p.nif_cif ?? "").toLowerCase().includes(s);
      if (!matches) continue;
    }

    clientes.push({
      ...p,
      email,
      usuario_id: p.id,
      b2b_aprobado: p.b2b_aprobado === true,
      descuento_b2b: p.descuento_b2b ?? 0,
    });
  }

  // Si hay búsqueda, el count no es exacto (filtramos en memoria), pero es aceptable
  return { clientes, total: busqueda ? clientes.length : (count ?? 0), error: null };
}
