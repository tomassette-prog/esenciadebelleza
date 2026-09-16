"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionFromCookie } from "@/lib/supabase/session-helper";
import { verificarAdmin } from "@/lib/admin-auth";
import { revalidatePath } from "next/cache";

const BUCKET = "facturas";

// ── Listar facturas del profesional logueado ─────────────────────────────────
export async function listarMisFacturas() {
  const session = await getSessionFromCookie();
  if (!session) return [];

  const admin = createAdminClient();
  const { data } = await admin
    .from("facturas")
    .select("id, nombre, archivo_path, archivo_size, created_at")
    .or(`profesional_id.eq.${session.id},email_cliente.eq.${session.email}`)
    .order("created_at", { ascending: false });

  // Generar URLs firmadas (bucket privado)
  const facturasConUrl = await Promise.all(
    (data ?? []).map(async (f) => {
      const { data: signed } = await admin.storage
        .from(BUCKET)
        .createSignedUrl(f.archivo_path, 3600); // 1 hora
      return { ...f, url: signed?.signedUrl ?? null };
    })
  );

  return facturasConUrl;
}

// ── Subir factura (solo admin) ───────────────────────────────────────────────
export async function subirFactura(
  profesionalId: string,
  nombre: string,
  archivo: File
): Promise<{ error?: string }> {
  const admin_user = await verificarAdmin();
  if (!admin_user) return { error: "No autorizado" };

  if (!nombre.trim()) return { error: "El nombre es obligatorio" };
  if (!archivo || archivo.size === 0) return { error: "Selecciona un archivo" };

  const supabase = createAdminClient();

  // Asegurar que el bucket existe
  const { data: buckets } = await supabase.storage.listBuckets();
  if (!(buckets ?? []).some((b) => b.name === BUCKET)) {
    await supabase.storage.createBucket(BUCKET, { public: false, fileSizeLimit: 10_485_760 }); // 10 MB
  }

  // Nombre único para evitar colisiones
  const ext = archivo.name.split(".").pop() ?? "pdf";
  const ts = Date.now();
  const path = `profesionales/${profesionalId}/${ts}-${nombre.replace(/[^a-zA-Z0-9]/g, "_")}.${ext}`;

  const buffer = Buffer.from(await archivo.arrayBuffer());
  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: archivo.type, upsert: false });

  if (uploadErr) return { error: `Error subiendo archivo: ${uploadErr.message}` };

  const { error: dbErr } = await supabase.from("facturas").insert({
    profesional_id: profesionalId,
    nombre: nombre.trim(),
    archivo_path: path,
    archivo_size: archivo.size,
  });

  if (dbErr) {
    // Limpiar archivo si falla la inserción en BD
    await supabase.storage.from(BUCKET).remove([path]);
    return { error: `Error guardando factura: ${dbErr.message}` };
  }

  revalidatePath("/admin/profesionales");
  return {};
}

// ── Eliminar factura (solo admin) ────────────────────────────────────────────
export async function eliminarFactura(id: string): Promise<{ error?: string }> {
  const admin_user = await verificarAdmin();
  if (!admin_user) return { error: "No autorizado" };

  const supabase = createAdminClient();

  const { data: factura } = await supabase
    .from("facturas")
    .select("archivo_path")
    .eq("id", id)
    .single();

  if (!factura) return { error: "Factura no encontrada" };

  // Eliminar archivo de Storage
  await supabase.storage.from(BUCKET).remove([factura.archivo_path]);

  // Eliminar registro
  const { error } = await supabase.from("facturas").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/admin/profesionales");
  return {};
}

// ── Listar facturas de un profesional (admin) ────────────────────────────────
export async function listarFacturasProfesional(profesionalId: string) {
  const admin_user = await verificarAdmin();
  if (!admin_user) return [];

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("facturas")
    .select("id, nombre, archivo_path, archivo_size, created_at")
    .eq("profesional_id", profesionalId)
    .order("created_at", { ascending: false });

  return data ?? [];
}

// ── Generar factura desde pedido (solo admin) ───────────────────────────────
export async function generarFacturaDesdePedido(
  pedidoId: string,
  usuarioIdOrEmail: string,
  numeroFactura: string,
  opciones?: {
    recargoEquivalencia?: number;
    formaPago?: string;
    vencimiento?: string;
    iban?: string;
    notas?: string;
  }
): Promise<{ error?: string; facturaId?: string }> {
  const admin_user = await verificarAdmin();
  if (!admin_user) return { error: "No autorizado" };

  const supabase = createAdminClient();

  // 1. Obtener pedido con líneas
  const { data: pedido, error: pedidoErr } = await supabase
    .from("pedidos")
    .select(`
      *,
      pedidos_lineas ( nombre_producto, nombre_variacion, sku, cantidad, precio_unitario, subtotal )
    `)
    .eq("id", pedidoId)
    .single();

  if (pedidoErr || !pedido) return { error: "Pedido no encontrado" };

  // 2. Resolver usuario: puede ser UUID o email
  let userId: string | null = null;
  let emailCliente: string = pedido.email_cliente;
  let perfil = null;

  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(usuarioIdOrEmail);

  if (isUUID) {
    userId = usuarioIdOrEmail;
  } else {
    // Es un email — buscar usuario en auth
    emailCliente = usuarioIdOrEmail;
    const { data: authUsers } = await supabase.auth.admin.listUsers();
    const user = authUsers.users.find(u => u.email?.toLowerCase() === emailCliente.toLowerCase());
    if (user) userId = user.id;
  }

  // 3. Obtener perfil si tenemos userId
  if (userId) {
    const { data } = await supabase
      .from("perfiles_usuario")
      .select("nombre_completo, empresa, nif_cif, direccion_envio, telefono_contacto, direccion_facturacion")
      .eq("id", userId)
      .single();
    perfil = data;
  }

  // 4. Generar HTML
  const { pedidoAFactura, generarHtmlFactura } = await import("@/lib/factura-generator");

  const pedidoConFacturacion = {
    ...pedido,
    facturacion: perfil ? {
      empresa: perfil.empresa ?? perfil.nombre_completo ?? undefined,
      nif_cif: perfil.nif_cif ?? undefined,
      direccion: perfil.direccion_facturacion?.calle ?? perfil.direccion_envio?.calle ?? undefined,
      ciudad: perfil.direccion_facturacion?.ciudad ?? perfil.direccion_envio?.ciudad ?? undefined,
      provincia: perfil.direccion_facturacion?.provincia ?? perfil.direccion_envio?.provincia ?? undefined,
      codigo_postal: perfil.direccion_facturacion?.cp ?? perfil.direccion_envio?.cp ?? undefined,
    } : pedido.facturacion ?? null,
  };

  const datos = pedidoAFactura(pedidoConFacturacion);
  if (numeroFactura) datos.numero = numeroFactura;
  if (opciones?.recargoEquivalencia) datos.recargoEquivalencia = opciones.recargoEquivalencia;
  if (opciones?.formaPago) datos.formaPago = opciones.formaPago;
  if (opciones?.vencimiento) datos.vencimiento = opciones.vencimiento;
  if (opciones?.iban) datos.iban = opciones.iban;
  if (opciones?.notas) datos.notas = opciones.notas;
  const html = generarHtmlFactura(datos);
  const buffer = Buffer.from(html, "utf8");

  // 5. Subir a Storage
  const nombre = numeroFactura || datos.numero;
  const carpeta = userId || emailCliente.replace(/[^a-zA-Z0-9]/g, "_");
  const storagePath = `facturas/${carpeta}/${Date.now()}-${nombre.replace(/[^a-zA-Z0-9]/g, "_")}.html`;

  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, { contentType: "text/html; charset=utf-8", upsert: false });

  if (uploadErr) return { error: `Error subiendo factura: ${uploadErr.message}` };

  // 6. Guardar en BD
  const facturaData: Record<string, unknown> = {
    nombre: `${nombre} — Pedido #${pedidoId.slice(0, 8).toUpperCase()}`,
    archivo_path: storagePath,
    archivo_size: buffer.length,
  };

  if (userId) {
    facturaData.profesional_id = userId;
  } else {
    facturaData.email_cliente = emailCliente;
  }

  const { data: factura, error: dbErr } = await supabase
    .from("facturas")
    .insert(facturaData)
    .select("id")
    .single();

  if (dbErr) {
    await supabase.storage.from(BUCKET).remove([storagePath]);
    return { error: `Error guardando factura: ${dbErr.message}` };
  }

  revalidatePath("/admin/profesionales");
  revalidatePath("/admin/facturas");
  return { facturaId: factura?.id };
}

// ── Listar todos los clientes con pedidos (admin) ───────────────────────────
export async function listarClientesConPedidos() {
  const admin_user = await verificarAdmin();
  if (!admin_user) return [];

  const supabase = createAdminClient();

  // Obtener todos los pedidos con datos de cliente
  const { data: pedidos } = await supabase
    .from("pedidos")
    .select("id, email_cliente, usuario_id, total, created_at, estado")
    .order("created_at", { ascending: false });

  if (!pedidos) return [];

  // Agrupar por cliente (email como clave principal)
  const clientesMap = new Map<string, {
    email: string;
    nombre: string;
    usuario_id: string | null;
    nif_cif: string | null;
    tipo_cliente: string;
    num_pedidos: number;
    total_gastado: number;
    ultimo_pedido: string;
  }>();

  for (const p of pedidos) {
    const email = p.email_cliente?.toLowerCase();
    if (!email) continue;

    if (clientesMap.has(email)) {
      const c = clientesMap.get(email)!;
      c.num_pedidos++;
      c.total_gastado += Number(p.total);
      if (new Date(p.created_at) > new Date(c.ultimo_pedido)) {
        c.ultimo_pedido = p.created_at;
      }
    } else {
      clientesMap.set(email, {
        email,
        nombre: "",
        usuario_id: p.usuario_id,
        nif_cif: null,
        tipo_cliente: "b2c",
        num_pedidos: 1,
        total_gastado: Number(p.total),
        ultimo_pedido: p.created_at,
      });
    }
  }

  // Enriquecer con datos de perfil si tienen usuario_id
  for (const cliente of clientesMap.values()) {
    if (cliente.usuario_id) {
      const { data: perfil } = await supabase
        .from("perfiles_usuario")
        .select("nombre_completo, nif_cif, tipo_cliente, empresa")
        .eq("id", cliente.usuario_id)
        .single();

      if (perfil) {
        cliente.nombre = perfil.empresa ?? perfil.nombre_completo ?? "";
        cliente.nif_cif = perfil.nif_cif;
        cliente.tipo_cliente = perfil.tipo_cliente;
      }
    }
  }

  return Array.from(clientesMap.values())
    .sort((a, b) => new Date(b.ultimo_pedido).getTime() - new Date(a.ultimo_pedido).getTime());
}

// ── Listar pedidos de un cliente por email (admin) ──────────────────────────
export async function listarPedidosCliente(email: string) {
  const supabase = createAdminClient();

  const { data: pedidos } = await supabase
    .from("pedidos")
    .select("id, estado, total, created_at, metodo_pago, email_cliente")
    .ilike("email_cliente", email)
    .order("created_at", { ascending: false });

  return pedidos ?? [];
}

// ── Listar todas las facturas con URL firmada (admin) ───────────────────────
export async function listarTodasFacturas() {
  const supabase = createAdminClient();

  const { data: facturas } = await supabase
    .from("facturas")
    .select("id, nombre, archivo_path, archivo_size, created_at, profesional_id, email_cliente")
    .order("created_at", { ascending: false });

  if (!facturas) return [];

  // Generar URLs firmadas y resolver emails
  const resultado = await Promise.all(
    facturas.map(async (f) => {
      const { data: signed } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(f.archivo_path, 3600);

      // Resolver email del cliente
      let email = f.email_cliente ?? "";
      if (!email && f.profesional_id) {
        const { data: { user } } = await supabase.auth.admin.getUserById(f.profesional_id);
        email = user?.email ?? "";
      }

      return {
        id: f.id,
        nombre: f.nombre,
        archivo_path: f.archivo_path,
        archivo_size: f.archivo_size,
        created_at: f.created_at,
        email_cliente: email,
        url: signed?.signedUrl ?? null,
      };
    })
  );

  return resultado;
}

// ── Enviar factura por email (admin) ────────────────────────────────────────
export async function enviarFacturaEmail(
  facturaId: string,
  email: string
): Promise<{ error?: string }> {
  const admin_user = await verificarAdmin();
  if (!admin_user) return { error: "No autorizado" };

  const supabase = createAdminClient();

  // Obtener factura con URL firmada
  const { data: factura } = await supabase
    .from("facturas")
    .select("id, nombre, archivo_path")
    .eq("id", facturaId)
    .single();

  if (!factura) return { error: "Factura no encontrada" };

  const { data: signed } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(factura.archivo_path, 604800); // 7 días

  if (!signed?.signedUrl) return { error: "No se pudo generar el enlace de descarga" };

  // Enviar email con el enlace
  const { enviarEmail } = await import("@/lib/email");
  await enviarEmail({
    to: email,
    subject: `Factura ${factura.nombre} — Esencia de Belleza`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px">
        <h2 style="color:#C4857A">Tu factura de Esencia de Belleza</h2>
        <p>Hola,</p>
        <p>Tienes una nueva factura disponible: <strong>${factura.nombre}</strong></p>
        <p style="margin:24px 0">
          <a href="${signed.signedUrl}" style="background:#C4857A;color:#fff;padding:12px 24px;text-decoration:none;border-radius:4px;font-weight:600">
            Ver factura
          </a>
        </p>
        <p style="color:#888;font-size:12px">Este enlace expira en 7 días. Si tienes alguna pregunta, responde a este email.</p>
        <hr style="border:none;border-top:1px solid #eee;margin:20px 0">
        <p style="color:#aaa;font-size:11px">Esencia de Belleza · Peluquería · Estética · Perfumería</p>
      </div>
    `,
  });

  return {};
}
