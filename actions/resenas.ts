"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Resena, ResenaAggregate } from "@/types/producto";

// ─── Crear reseña (usuario autenticado) ──────────────────────────────────────
export async function crearResena(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Debes iniciar sesión para dejar una reseña." };

  const producto_id  = formData.get("producto_id")  as string;
  const autor_nombre = formData.get("autor_nombre")  as string;
  const valoracion   = Number(formData.get("valoracion"));
  const titulo       = (formData.get("titulo") as string).trim() || null;
  const cuerpo       = (formData.get("cuerpo")  as string).trim();

  if (!producto_id || !autor_nombre || !cuerpo || valoracion < 1 || valoracion > 5) {
    return { error: "Datos incompletos. Revisa el formulario." };
  }

  // Comprobar que el usuario no haya reseñado ya este producto
  const { data: existente } = await supabase
    .from("resenas")
    .select("id")
    .eq("producto_id", producto_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existente) return { error: "Ya has dejado una reseña para este producto." };

  const { error } = await supabase.from("resenas").insert({
    producto_id,
    user_id: user.id,
    autor_nombre: autor_nombre.slice(0, 80),
    valoracion,
    titulo: titulo?.slice(0, 120),
    cuerpo: cuerpo.slice(0, 2000),
    aprobada: false, // pendiente de moderación
  });

  if (error) return { error: "Error al guardar la reseña. Inténtalo de nuevo." };

  revalidatePath(`/productos`);
  return { ok: true };
}

// ─── Leer reseñas aprobadas de un producto ───────────────────────────────────
export async function getResenas(producto_id: string): Promise<Resena[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("resenas")
    .select("*")
    .eq("producto_id", producto_id)
    .eq("aprobada", true)
    .order("created_at", { ascending: false });
  return (data ?? []) as Resena[];
}

// ─── Leer aggregate de un producto ───────────────────────────────────────────
export async function getResenaAggregate(
  producto_id: string
): Promise<ResenaAggregate | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("resenas_aggregate")
    .select("*")
    .eq("producto_id", producto_id)
    .maybeSingle();
  return data as ResenaAggregate | null;
}

// ─── Admin: listar todas las reseñas pendientes ───────────────────────────────
export async function getResenasPendientes(): Promise<Resena[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("resenas")
    .select("*, productos_padre(nombre, slug)")
    .eq("aprobada", false)
    .order("created_at", { ascending: true });
  return (data ?? []) as Resena[];
}

// ─── Admin: aprobar / rechazar reseña ────────────────────────────────────────
export async function moderarResena(id: string, aprobar: boolean) {
  const supabase = createAdminClient();
  if (aprobar) {
    await supabase.from("resenas").update({ aprobada: true }).eq("id", id);
  } else {
    await supabase.from("resenas").delete().eq("id", id);
  }
  revalidatePath("/admin/resenas");
}
