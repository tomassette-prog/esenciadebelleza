"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { verificarAdmin } from "@/lib/admin-auth";
import { revalidatePath } from "next/cache";

const BUCKET = "facturas";

// ── Listar facturas del profesional logueado ─────────────────────────────────
export async function listarMisFacturas() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const admin = createAdminClient();
  const { data } = await admin
    .from("facturas")
    .select("id, nombre, archivo_path, archivo_size, created_at")
    .eq("profesional_id", user.id)
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
  profesionalId: string,
  numeroFactura: string
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

  // 2. Obtener datos del profesional para la dirección de facturación
  const { data: perfil } = await supabase
    .from("perfiles_usuario")
    .select("nombre_completo, empresa, nif_cif, direccion_envio, telefono_contacto")
    .eq("id", profesionalId)
    .single();

  // 3. Generar HTML
  const { pedidoAFactura, generarHtmlFactura } = await import("@/lib/factura-generator");

  // Añadir datos de facturación del perfil al pedido
  const pedidoConFacturacion = {
    ...pedido,
    facturacion: perfil ? {
      empresa: perfil.empresa ?? undefined,
      nif_cif: perfil.nif_cif ?? undefined,
      direccion: perfil.direccion_envio?.calle ?? undefined,
      ciudad: perfil.direccion_envio?.ciudad ?? undefined,
      provincia: perfil.direccion_envio?.provincia ?? undefined,
      codigo_postal: perfil.direccion_envio?.cp ?? undefined,
    } : null,
  };

  const datos = pedidoAFactura(pedidoConFacturacion);
  // Sobrescribir número de factura si se proporciona uno personalizado
  if (numeroFactura) {
    datos.numero = numeroFactura;
  }
  const html = generarHtmlFactura(datos);
  const buffer = Buffer.from(html, "utf8");

  // 4. Subir a Storage
  const nombre = numeroFactura || datos.numero;
  const path = `profesionales/${profesionalId}/${Date.now()}-${nombre.replace(/[^a-zA-Z0-9]/g, "_")}.html`;

  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: "text/html; charset=utf-8", upsert: false });

  if (uploadErr) return { error: `Error subiendo factura: ${uploadErr.message}` };

  // 5. Guardar en BD
  const { data: factura, error: dbErr } = await supabase
    .from("facturas")
    .insert({
      profesional_id: profesionalId,
      nombre: `${nombre} — Pedido #${pedidoId.slice(0, 8).toUpperCase()}`,
      archivo_path: path,
      archivo_size: buffer.length,
    })
    .select("id")
    .single();

  if (dbErr) {
    await supabase.storage.from(BUCKET).remove([path]);
    return { error: `Error guardando factura: ${dbErr.message}` };
  }

  revalidatePath("/admin/profesionales");
  return { facturaId: factura?.id };
}

// ── Listar pedidos de un profesional (admin) ────────────────────────────────
export async function listarPedidosProfesional(profesionalId: string) {
  const admin_user = await verificarAdmin();
  if (!admin_user) return [];

  const supabase = createAdminClient();

  // Buscar email del profesional
  const { data: { user } } = await supabase.auth.admin.getUserById(profesionalId);
  const email = user?.email;
  if (!email) return [];

  // Buscar pedidos por usuario_id O por email
  const { data: pedidosPorId } = await supabase
    .from("pedidos")
    .select("id, estado, total, created_at, metodo_pago, email_cliente")
    .eq("usuario_id", profesionalId)
    .order("created_at", { ascending: false });

  const { data: pedidosPorEmail } = await supabase
    .from("pedidos")
    .select("id, estado, total, created_at, metodo_pago, email_cliente")
    .eq("email_cliente", email)
    .is("usuario_id", null)
    .order("created_at", { ascending: false });

  // Combinar y deduplicar
  const all = [...(pedidosPorId ?? []), ...(pedidosPorEmail ?? [])];
  const unique = all.filter((p, i, arr) => arr.findIndex(x => x.id === p.id) === i);
  return unique.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}
