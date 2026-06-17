"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// ── Login ─────────────────────────────────────────────────────────────────────
export async function login(
  _prevState: { error: string; redirectTo?: string } | null,
  formData: FormData
): Promise<{ error: string; redirectTo?: string }> {
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email: (formData.get("email") as string).trim().toLowerCase(),
    password: formData.get("password") as string,
  });

  if (error) {
    return { error: "Credenciales incorrectas. Verifica tu email y contraseña." };
  }

  const redirectTo = (formData.get("redirectTo") as string) || "/cuenta";
  revalidatePath("/", "layout");
  redirect(redirectTo);
}

// ── Registro ──────────────────────────────────────────────────────────────────
export async function registro(
  _prevState: { error: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  const supabase = await createClient();

  const email          = (formData.get("email") as string).trim().toLowerCase();
  const password       = formData.get("password") as string;
  const nombre_completo = (formData.get("nombre_completo") as string).trim();
  const tipo_cliente   = (formData.get("tipo_cliente") as string) === "b2b" ? "b2b" : "b2c";
  const empresa        = (formData.get("empresa") as string | null)?.trim() || null;
  const nif_cif        = (formData.get("nif_cif") as string | null)?.trim() || null;
  const telefono       = (formData.get("telefono") as string | null)?.trim() || null;

  if (password.length < 8) {
    return { error: "La contraseña debe tener al menos 8 caracteres." };
  }

  if (tipo_cliente === "b2b" && !empresa) {
    return { error: "El nombre de empresa es obligatorio para cuentas profesionales." };
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { nombre_completo, tipo_cliente },
    },
  });

  if (error) {
    if (error.message.toLowerCase().includes("already registered")) {
      return { error: "Este email ya está registrado. Prueba a iniciar sesión." };
    }
    return { error: "Error al crear la cuenta. Inténtalo de nuevo." };
  }

  // Crear perfil en perfiles_usuario
  if (data.user) {
    await supabase.from("perfiles_usuario").upsert({
      id: data.user.id,
      nombre_completo,
      tipo_cliente,
      empresa: tipo_cliente === "b2b" ? empresa : null,
      nif_cif:  tipo_cliente === "b2b" ? nif_cif  : null,
      telefono,
      b2b_aprobado: false,
    });
  }

  revalidatePath("/", "layout");
  redirect("/cuenta?bienvenido=1");
}

// ── Logout ────────────────────────────────────────────────────────────────────
export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}

// ── Recuperar contraseña ──────────────────────────────────────────────────────
export async function recuperarPassword(
  _prevState: { error: string; success: boolean } | null,
  formData: FormData
): Promise<{ error: string; success: boolean }> {
  const supabase = await createClient();
  const email = (formData.get("email") as string).trim().toLowerCase();

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://esenciadebelleza.es";

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl}/auth/callback?next=/cuenta/nueva-password`,
  });

  if (error) {
    return { error: "No se pudo enviar el email. Verifica la dirección.", success: false };
  }

  return { error: "", success: true };
}

// ── Nueva contraseña (tras reset) ─────────────────────────────────────────────
export async function nuevaPassword(
  _prevState: { error: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  const supabase = await createClient();
  const password  = formData.get("password") as string;
  const confirmar = formData.get("confirmar") as string;

  if (password.length < 8) {
    return { error: "La contraseña debe tener al menos 8 caracteres." };
  }
  if (password !== confirmar) {
    return { error: "Las contraseñas no coinciden." };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { error: "No se pudo actualizar la contraseña. El enlace puede haber expirado." };
  }

  revalidatePath("/", "layout");
  redirect("/cuenta?password_actualizado=1");
}

// ── Actualizar perfil ─────────────────────────────────────────────────────────
export async function actualizarPerfil(
  formData: FormData
): Promise<{ error: string; success: boolean }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "No autenticado.", success: false };
  }

  const { error } = await supabase
    .from("perfiles_usuario")
    .update({
      nombre_completo: (formData.get("nombre_completo") as string).trim(),
      telefono:        (formData.get("telefono") as string | null)?.trim() || null,
      empresa:         (formData.get("empresa") as string | null)?.trim() || null,
      nif_cif:         (formData.get("nif_cif") as string | null)?.trim() || null,
    })
    .eq("id", user.id);

  if (error) {
    return { error: "No se pudo guardar el perfil. Inténtalo de nuevo.", success: false };
  }

  revalidatePath("/cuenta");
  return { error: "", success: true };
}
