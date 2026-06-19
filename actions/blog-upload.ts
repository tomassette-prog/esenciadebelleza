"use server";

import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const ADMIN_EMAILS = ["ziarresamot@gmail.com"];
const BUCKET = "blog";

async function verificarAdmin() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user && ADMIN_EMAILS.includes(user.email ?? "")) return true;
  } catch { /* ignorar */ }

  try {
    const cookieStore = await cookies();
    const projectRef = "yjanobsfzcwpusynvlun";
    const cookieName = `sb-${projectRef}-auth-token`;
    let tokenValue = cookieStore.get(cookieName)?.value;
    if (!tokenValue) {
      let combined = "";
      for (let i = 0; i < 5; i++) {
        const chunk = cookieStore.get(`${cookieName}.${i}`)?.value;
        if (!chunk) break;
        combined += chunk;
      }
      if (combined) tokenValue = combined;
    }
    if (!tokenValue) return false;
    const parsed = JSON.parse(tokenValue);
    const accessToken: string = parsed.access_token;
    if (!accessToken) return false;
    const payloadB64 = accessToken.split(".")[1];
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString());
    const userId: string = payload.sub;
    if (!userId) return false;
    const admin = createAdminClient();
    const { data: { user } } = await admin.auth.admin.getUserById(userId);
    return !!(user && ADMIN_EMAILS.includes(user.email ?? ""));
  } catch {
    return false;
  }
}

export async function subirImagenBlog(
  formData: FormData
): Promise<{ url: string | null; error?: string }> {
  const esAdmin = await verificarAdmin();
  if (!esAdmin) return { url: null, error: "No autorizado" };

  const file = formData.get("imagen") as File | null;
  const slug = (formData.get("slug") as string | null)?.trim() || "imagen";

  if (!file || file.size === 0) return { url: null, error: "No se ha seleccionado ninguna imagen" };

  // Validar tipo
  const tiposPermitidos = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (!tiposPermitidos.includes(file.type)) {
    return { url: null, error: "Formato no permitido. Usa JPG, PNG, WebP o GIF." };
  }

  // Tamaño máximo: 4 MB
  if (file.size > 4 * 1024 * 1024) {
    return { url: null, error: "La imagen no puede superar los 4 MB." };
  }

  // Nombre de archivo SEO-friendly: [slug]-[timestamp].[ext]
  const ext = file.type.split("/")[1].replace("jpeg", "jpg");
  const timestamp = Date.now();
  const nombreArchivo = `posts/${slug}-${timestamp}.${ext}`;

  const buffer = Buffer.from(await file.arrayBuffer());

  const supabase = createAdminClient();

  // Asegurar que el bucket existe
  const { data: buckets } = await supabase.storage.listBuckets();
  const bucketExiste = (buckets ?? []).some((b) => b.name === BUCKET);
  if (!bucketExiste) {
    await supabase.storage.createBucket(BUCKET, { public: true });
  }

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(nombreArchivo, buffer, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) return { url: null, error: uploadError.message };

  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(nombreArchivo);

  return { url: publicUrl };
}
