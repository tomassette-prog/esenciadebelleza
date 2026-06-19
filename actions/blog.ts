"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const ADMIN_EMAILS = ["ziarresamot@gmail.com"];

async function verificarAdmin() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user && ADMIN_EMAILS.includes(user.email ?? "")) return user;
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
    if (!tokenValue) return null;
    const parsed = JSON.parse(tokenValue);
    const accessToken: string = parsed.access_token;
    if (!accessToken) return null;
    const payloadB64 = accessToken.split(".")[1];
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString());
    const userId: string = payload.sub;
    if (!userId) return null;
    const admin = createAdminClient();
    const { data: { user } } = await admin.auth.admin.getUserById(userId);
    if (user && ADMIN_EMAILS.includes(user.email ?? "")) return user;
    return null;
  } catch {
    return null;
  }
}

function slugify(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 100);
}

export async function crearPost(
  _prevState: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string }> {
  const admin_user = await verificarAdmin();
  if (!admin_user) return { error: "No autorizado" };

  const titulo          = (formData.get("titulo") as string).trim();
  const slug_input      = (formData.get("slug") as string).trim();
  const resumen         = (formData.get("resumen") as string).trim();
  const contenido_html  = (formData.get("contenido_html") as string).trim();
  const seo_title       = (formData.get("seo_title") as string).trim().slice(0, 60);
  const seo_description = (formData.get("seo_description") as string).trim().slice(0, 160);
  const imagen_url      = (formData.get("imagen_url") as string | null)?.trim() || null;
  const imagen_alt      = (formData.get("imagen_alt") as string | null)?.trim() || null;
  const keywords        = (formData.get("keywords") as string | null)?.trim() || null;
  const publicado         = formData.get("publicado") === "on";
  const destacado         = formData.get("destacado") === "on";
  const autor             = (formData.get("autor") as string | null)?.trim() || "Esencia de Belleza";
  const social_facebook   = (formData.get("social_facebook") as string | null)?.trim() || null;
  const social_instagram  = (formData.get("social_instagram") as string | null)?.trim() || null;
  const social_tiktok     = (formData.get("social_tiktok") as string | null)?.trim() || null;

  if (!titulo || !contenido_html) return { error: "Título y contenido son obligatorios" };

  const slug = slug_input || slugify(titulo);

  const supabase = createAdminClient();
  const { error } = await supabase.from("posts").insert({
    titulo,
    slug,
    resumen: resumen || null,
    contenido_html,
    seo_title:       seo_title || null,
    seo_description: seo_description || null,
    imagen_url,
    imagen_alt,
    keywords,
    social_facebook,
    social_instagram,
    social_tiktok,
    publicado,
    destacado,
    autor,
    published_at: publicado ? new Date().toISOString() : null,
  });

  if (error) return { error: error.message };

  revalidatePath("/admin/blog");
  revalidatePath("/blog");
  redirect("/admin/blog");
}

export async function actualizarPost(
  id: string,
  _prevState: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string }> {
  const admin_user = await verificarAdmin();
  if (!admin_user) return { error: "No autorizado" };

  const titulo          = (formData.get("titulo") as string).trim();
  const slug            = (formData.get("slug") as string).trim();
  const resumen         = (formData.get("resumen") as string).trim();
  const contenido_html  = (formData.get("contenido_html") as string).trim();
  const seo_title       = (formData.get("seo_title") as string).trim().slice(0, 60);
  const seo_description = (formData.get("seo_description") as string).trim().slice(0, 160);
  const imagen_url      = (formData.get("imagen_url") as string | null)?.trim() || null;
  const imagen_alt      = (formData.get("imagen_alt") as string | null)?.trim() || null;
  const keywords        = (formData.get("keywords") as string | null)?.trim() || null;
  const publicado         = formData.get("publicado") === "on";
  const destacado         = formData.get("destacado") === "on";
  const autor             = (formData.get("autor") as string | null)?.trim() || "Esencia de Belleza";
  const social_facebook   = (formData.get("social_facebook") as string | null)?.trim() || null;
  const social_instagram  = (formData.get("social_instagram") as string | null)?.trim() || null;
  const social_tiktok     = (formData.get("social_tiktok") as string | null)?.trim() || null;

  if (!titulo || !contenido_html) return { error: "Título y contenido son obligatorios" };

  const supabase = createAdminClient();

  // Recuperar published_at actual para no sobreescribir si ya estaba publicado
  const { data: existing } = await supabase
    .from("posts")
    .select("publicado, published_at")
    .eq("id", id)
    .single();

  const published_at =
    publicado && !existing?.published_at
      ? new Date().toISOString()
      : (publicado ? existing?.published_at : null);

  const { error } = await supabase.from("posts").update({
    titulo,
    slug,
    resumen: resumen || null,
    contenido_html,
    seo_title:       seo_title || null,
    seo_description: seo_description || null,
    imagen_url,
    imagen_alt,
    keywords,
    social_facebook,
    social_instagram,
    social_tiktok,
    publicado,
    destacado,
    autor,
    published_at,
  }).eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/admin/blog");
  revalidatePath("/blog");
  revalidatePath(`/blog/${slug}`);
  redirect("/admin/blog");
}

export async function eliminarPost(id: string): Promise<{ error?: string }> {
  const admin_user = await verificarAdmin();
  if (!admin_user) return { error: "No autorizado" };

  const supabase = createAdminClient();
  const { error } = await supabase.from("posts").delete().eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/admin/blog");
  revalidatePath("/blog");
  return {};
}
