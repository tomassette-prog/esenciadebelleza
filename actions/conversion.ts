"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { verificarTokenResena } from "@/lib/resena-token";

// Server actions for the conversion flows (restock alerts, abandoned carts and
// guest reviews). All writes go through the service-role client: the public
// only ever calls these actions.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function suscribirAvisoReposicion(
  productoId: string,
  variacionId: string | null,
  email: string
): Promise<{ ok: boolean; error?: string }> {
  const limpio = email.trim().toLowerCase();
  if (!EMAIL_RE.test(limpio)) return { ok: false, error: "Introduce un email válido." };
  if (!productoId) return { ok: false, error: "Producto no válido." };

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("avisos_reposicion")
    .upsert(
      { producto_id: productoId, variacion_id: variacionId, email: limpio },
      { onConflict: "producto_id,email", ignoreDuplicates: true }
    );
  if (error) return { ok: false, error: "No se pudo guardar el aviso. Inténtalo de nuevo." };
  return { ok: true };
}

export async function registrarIntentoCompra(
  email: string,
  items: Array<{
    variacion_id: string; producto_id: string; slug: string; categoria: string;
    subcategoria: string | null; nombre: string; nombre_variacion: string;
    imagen_url: string | null; precio: number; cantidad: number; sku: string;
  }>
): Promise<void> {
  const limpio = (email ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(limpio) || !items?.length) return;
  const supabase = createAdminClient();
  await supabase.from("carritos_abandonados").insert({ email: limpio, items });
}

export async function crearResenaConToken(
  token: string,
  datos: {
    email: string; productoId: string; pedidoId: string;
    autor_nombre: string; valoracion: number; titulo?: string; cuerpo: string;
  }
): Promise<{ ok: boolean; error?: string }> {
  if (!verificarTokenResena(token, datos)) {
    return { ok: false, error: "El enlace no es válido o ha caducado." };
  }
  const valoracion = Math.round(Number(datos.valoracion));
  if (!(valoracion >= 1 && valoracion <= 5)) return { ok: false, error: "Puntuación no válida." };
  const cuerpo = (datos.cuerpo ?? "").trim();
  if (cuerpo.length < 5) return { ok: false, error: "Escribe unas palabras sobre el producto." };

  const supabase = createAdminClient();
  const { error } = await supabase.from("resenas").insert({
    producto_id: datos.productoId,
    user_id: null,
    autor_nombre: (datos.autor_nombre ?? "").trim().slice(0, 60) || "Cliente",
    valoracion,
    titulo: (datos.titulo ?? "").trim().slice(0, 120) || null,
    cuerpo: cuerpo.slice(0, 2000),
    aprobada: false,
  });
  if (error) return { ok: false, error: "No se pudo publicar la reseña. Inténtalo de nuevo." };
  return { ok: true };
}
