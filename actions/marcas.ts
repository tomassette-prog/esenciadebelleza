"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createClient as createSupabase } from "@supabase/supabase-js";

const ADMIN_EMAILS = ["ziarresamot@gmail.com"];

function adminClient() {
  return createSupabase(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function verificarAdmin() {
  try {
    const cookieStore = await cookies();
    const cookieName = `sb-yjanobsfzcwpusynvlun-auth-token`;
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
    if (tokenValue) {
      const parsed = JSON.parse(tokenValue);
      const payload = JSON.parse(Buffer.from(parsed.access_token.split(".")[1], "base64url").toString());
      if (payload.sub && payload.exp * 1000 > Date.now() && ADMIN_EMAILS.includes(payload.email)) return;
    }
  } catch { /* ignorar */ }
  throw new Error("No autorizado");
}

function slugify(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export async function crearMarca(data: {
  nombre: string;
  logo_url?: string | null;
}): Promise<{ ok?: boolean; error?: string; id?: string }> {
  await verificarAdmin();
  const supa = adminClient();
  const slug = slugify(data.nombre);
  const { data: row, error } = await supa.from("marcas")
    .insert({ nombre: data.nombre.trim(), slug, logo_url: data.logo_url ?? null, activa: true })
    .select("id").single();
  if (error) return { error: error.message };
  revalidatePath("/admin/marcas");
  revalidatePath("/marcas");
  revalidatePath("/");
  return { ok: true, id: row.id };
}

export async function actualizarMarca(id: string, data: {
  nombre?: string;
  logo_url?: string | null;
  activa?: boolean;
}): Promise<{ ok?: boolean; error?: string }> {
  await verificarAdmin();
  const supa = adminClient();
  const update: Record<string, unknown> = {};
  if (data.nombre !== undefined) {
    update.nombre = data.nombre.trim();
    update.slug = slugify(data.nombre);
  }
  if (data.logo_url !== undefined) update.logo_url = data.logo_url;
  if (data.activa !== undefined) update.activa = data.activa;
  const { error } = await supa.from("marcas").update(update).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/marcas");
  revalidatePath("/marcas");
  revalidatePath("/");
  return { ok: true };
}

export async function subirLogoMarca(
  id: string,
  slug: string,
  file: FormData
): Promise<{ ok?: boolean; error?: string; url?: string }> {
  await verificarAdmin();
  const supa = adminClient();
  const f = file.get("file") as File | null;
  if (!f) return { error: "No se recibió archivo" };

  const ext = f.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `marcas/${slug}.${ext}`;
  const buffer = Buffer.from(await f.arrayBuffer());

  const { error: uploadErr } = await supa.storage
    .from("logos")
    .upload(path, buffer, { contentType: f.type, upsert: true });

  if (uploadErr) return { error: uploadErr.message };

  const { data: { publicUrl } } = supa.storage.from("logos").getPublicUrl(path);

  const { error: updateErr } = await supa.from("marcas").update({ logo_url: publicUrl }).eq("id", id);
  if (updateErr) return { error: updateErr.message };

  revalidatePath("/admin/marcas");
  revalidatePath("/marcas");
  revalidatePath("/");
  return { ok: true, url: publicUrl };
}
