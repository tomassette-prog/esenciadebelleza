import { createAdminClient } from "@/lib/supabase/admin";

export const TEXTO_CHECKOUT =
  "Acepto recibir ofertas y novedades de Esencia de Belleza por email. Puedo darme de baja en cualquier momento.";

export const TEXTO_NEWSLETTER =
  "Quiero suscribirme al boletín de Esencia de Belleza para recibir ofertas y novedades por email. Puedo darme de baja en cualquier momento.";

export type OrigenConsentimiento = "checkout" | "newsletter" | "registro";

export async function registrarConsentimiento(params: {
  email: string;
  origen: OrigenConsentimiento;
  texto: string;
  estado: "pendiente" | "confirmado";
}): Promise<{ token: string } | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("consentimientos")
    .insert({
      email: params.email.toLowerCase().trim(),
      origen: params.origen,
      texto_aceptado: params.texto,
      estado: params.estado,
      confirmado_at: params.estado === "confirmado" ? new Date().toISOString() : null,
    })
    .select("token_confirmacion")
    .single();

  if (error) {
    console.error("[Consentimientos] insert:", error.message);
    return null;
  }
  return { token: data.token_confirmacion };
}

export async function confirmarConsentimiento(token: string): Promise<boolean> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("consentimientos")
    .update({ estado: "confirmado", confirmado_at: new Date().toISOString() })
    .eq("token_confirmacion", token)
    .eq("estado", "pendiente")
    .select("id");

  if (error) {
    console.error("[Consentimientos] confirmar:", error.message);
    return false;
  }
  return (data?.length ?? 0) > 0;
}

export async function darDeBaja(token: string): Promise<boolean> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("consentimientos")
    .update({ estado: "baja", baja_at: new Date().toISOString() })
    .eq("token_confirmacion", token)
    .neq("estado", "baja")
    .select("id");

  if (error) {
    console.error("[Consentimientos] baja:", error.message);
    return false;
  }
  return (data?.length ?? 0) > 0;
}
