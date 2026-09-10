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
