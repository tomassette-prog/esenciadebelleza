"use server";

import { cookies } from "next/headers";

const ADMIN_EMAILS = ["ziarresamot@gmail.com"];
const PROJECT_REF = "yjanobsfzcwpusynvlun";

/** Verifica que el usuario autenticado sea admin leyendo la cookie de sesión de Supabase. */
export async function verificarAdmin() {
  const cookieStore = await cookies();
  const cookieName = `sb-${PROJECT_REF}-auth-token`;

  // Leer cookie completa o reconstruir desde chunks (igual que el admin layout)
  let raw = cookieStore.get(cookieName)?.value ?? "";
  if (!raw) {
    for (let i = 0; ; i++) {
      const chunk = cookieStore.get(`${cookieName}.${i}`)?.value;
      if (!chunk) break;
      raw += chunk;
    }
  }

  if (!raw) throw new Error("No autorizado");

  try {
    const decoded = raw.startsWith("%") ? decodeURIComponent(raw) : raw;
    const parsed = JSON.parse(decoded);
    const email: string = parsed?.user?.email ?? "";
    if (email && ADMIN_EMAILS.includes(email)) return { email };
  } catch {
    // cookie malformada
  }

  throw new Error("No autorizado");
}
