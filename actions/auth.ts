"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { enviarNotificacionNuevoProfesional } from "@/lib/email";

const ADMIN_EMAILS = ["ziarresamot@gmail.com"];

// ── Login ─────────────────────────────────────────────────────────────────────
export async function login(
  _prevState: { error: string; redirectTo?: string } | null,
  formData: FormData
): Promise<{ error: string; redirectTo?: string }> {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email: (formData.get("email") as string).trim().toLowerCase(),
    password: formData.get("password") as string,
  });

  if (error) {
    return { error: "Credenciales incorrectas. Verifica tu email y contraseña." };
  }

  const isAdmin = ADMIN_EMAILS.includes(data.user?.email ?? "");
  const rawRedirect = (formData.get("redirectTo") as string) || "/cuenta";

  // Si el redirectTo es sólo /admin (sin subpágina), corregir a /admin/productos
  const redirectTo = rawRedirect === "/admin" || rawRedirect === "/admin/"
    ? "/admin/productos"
    : rawRedirect === "/cuenta" && isAdmin
      ? "/admin/productos"
      : rawRedirect;

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

  // Validar NIF/CIF si se proporciona (opcional pero con formato correcto)
  if (tipo_cliente === "b2b" && nif_cif && !validarNifCif(nif_cif)) {
    return { error: "El NIF/CIF no tiene un formato válido. Ejemplos: 12345678Z, B12345678, X1234567L" };
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { nombre_completo, tipo_cliente },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://esenciadebelleza.es"}/auth/callback`,
    },
  });

  if (error) {
    if (error.message.toLowerCase().includes("already registered")) {
      return { error: "Este email ya está registrado. Prueba a iniciar sesión." };
    }
    return { error: "Error al crear la cuenta. Inténtalo de nuevo." };
  }

  // Crear perfil en perfiles_usuario (usar service_role para saltar RLS,
  // ya que el usuario aún no tiene sesión por la confirmación de email)
  if (data.user) {
    const admin = createAdminClient();
    await admin.from("perfiles_usuario").upsert({
      id: data.user.id,
      nombre_completo,
      tipo_cliente,
      empresa: tipo_cliente === "b2b" ? empresa : null,
      nif_cif:  tipo_cliente === "b2b" ? nif_cif  : null,
      telefono,
      b2b_aprobado: false,
    });

    // Notificar al admin si es un profesional B2B
    if (tipo_cliente === "b2b") {
      await enviarNotificacionNuevoProfesional({
        email,
        nombre: nombre_completo,
        empresa,
        nif_cif,
        telefono,
      });
    }
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

  const nif_cif = (formData.get("nif_cif") as string | null)?.trim() || null;

  // Validar NIF/CIF si se proporciona
  if (nif_cif && !validarNifCif(nif_cif)) {
    return { error: "El NIF/CIF no tiene un formato válido. Ejemplos: 12345678Z, B12345678, X1234567L", success: false };
  }

  const { error } = await supabase
    .from("perfiles_usuario")
    .update({
      nombre_completo: (formData.get("nombre_completo") as string).trim(),
      telefono:        (formData.get("telefono") as string | null)?.trim() || null,
      empresa:         (formData.get("empresa") as string | null)?.trim() || null,
      nif_cif,
    })
    .eq("id", user.id);

  if (error) {
    return { error: "No se pudo guardar el perfil. Inténtalo de nuevo.", success: false };
  }

  revalidatePath("/cuenta");
  return { error: "", success: true };
}

// ── Validación NIF / CIF / NIE ───────────────────────────────────────────────
const LETRAS_NIF = "TRWAGMYFPDXBNJZSQVHLCKE";
const CIF_LETRAS = "JABCDEFGHI";

function validarNifCif(valor: string): boolean {
  const raw = valor.toUpperCase().replace(/[\s\-]/g, "");
  if (raw.length < 8 || raw.length > 10) return false;

  // NIE: X/Y/Z + 7 dígitos + letra
  if (/^[XYZ]\d{7}[0-9A-Z]$/.test(raw)) {
    const num = raw.replace(/^X/, "0").replace(/^Y/, "1").replace(/^Z/, "2");
    return LETRAS_NIF[parseInt(num.slice(0, 8), 10) % 23] === raw[8];
  }

  // NIF: 8 dígitos + letra
  if (/^\d{8}[A-Z]$/.test(raw)) {
    return LETRAS_NIF[parseInt(raw.slice(0, 8), 10) % 23] === raw[8];
  }

  // CIF: [A-S] + 7 dígitos + control (dígito o letra)
  if (/^[A-S]\d{7}[0-9A-Z]$/.test(raw)) {
    const digits = raw.slice(1, 8);
    let sumPares = 0;
    let sumImpares = 0;
    for (let i = 0; i < 7; i++) {
      const d = parseInt(digits[i], 10);
      if (i % 2 === 0) {
        // Posición impar (1-indexed): multiplicar por 2
        const doble = d * 2;
        sumImpares += doble > 9 ? doble - 9 : doble;
      } else {
        sumPares += d;
      }
    }
    const total = sumPares + sumImpares;
    const controlDigit = (10 - (total % 10)) % 10;
    const control = raw[8];

    // El control puede ser dígito o letra (A-J = 1-9, 0)
    if (/\d/.test(control)) {
      return parseInt(control, 10) === controlDigit;
    }
    return CIF_LETRAS[controlDigit] === control;
  }

  return false;
}
