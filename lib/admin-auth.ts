"use server";

import { createClient } from "@/lib/supabase/server";

export const ADMIN_EMAILS = ["ziarresamot@gmail.com"];

/** Verifica que el usuario autenticado sea admin usando getUser() (valida contra Supabase). */
export async function verificarAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user && ADMIN_EMAILS.includes(user.email ?? "")) return user;
  throw new Error("No autorizado");
}
