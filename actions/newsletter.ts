"use server";

import { enviarEmail } from "@/lib/email";
import {
  confirmarConsentimiento,
  darDeBaja,
  registrarConsentimiento,
  TEXTO_CHECKOUT,
  TEXTO_NEWSLETTER,
} from "@/lib/consentimientos";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://esenciadebelleza.es";
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const PLANTILLA = (titulo: string, cuerpo: string, ctaTexto: string, ctaUrl: string) => `
  <div style="font-family:Georgia,serif;color:#3D2018;max-width:520px;margin:0 auto;padding:32px 24px">
    <p style="letter-spacing:3px;text-transform:uppercase;font-size:12px;color:#C4857A;margin:0 0 16px">Esencia de Belleza</p>
    <h1 style="font-size:24px;font-weight:normal;margin:0 0 16px">${titulo}</h1>
    <p style="font-size:15px;line-height:1.7;margin:0 0 24px">${cuerpo}</p>
    <p style="margin:0 0 32px">
      <a href="${ctaUrl}" style="background:#3D2018;color:#fff;padding:14px 28px;text-decoration:none;font-size:13px;letter-spacing:1px">${ctaTexto}</a>
    </p>
    <p style="font-size:11px;color:#9a8a84;line-height:1.6">
      Si no has solicitado este email, puedes ignorarlo.<br>
      Esencia de Belleza · esenciadebelleza.es · Peluquería · Estética · Perfumes
    </p>
  </div>`;

export async function suscribirseNewsletter(
  formData: FormData
): Promise<{ ok: boolean; mensaje: string }> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return { ok: false, mensaje: "Introduce un email válido." };
  }

  const r = await registrarConsentimiento({
    email,
    origen: "newsletter",
    texto: TEXTO_NEWSLETTER,
    estado: "pendiente",
  });
  if (!r) {
    return { ok: false, mensaje: "No se pudo procesar la suscripción. Inténtalo de nuevo." };
  }

  const url = `${SITE}/confirmar-suscripcion?token=${r.token}`;
  await enviarEmail({
    to: email,
    subject: "Confirma tu suscripción a Esencia de Belleza",
    html: PLANTILLA(
      "Confirma tu suscripción",
      "Has solicitado recibir ofertas y novedades de Esencia de Belleza por email. Para activar la suscripción, confirma pulsando el botón (así evitamos que nadie te dé de alta sin tu permiso).",
      "Confirmar suscripción",
      url
    ),
  });

  return {
    ok: true,
    mensaje: "Listo. Revisa tu email y confirma la suscripción (si no lo ves, mira la carpeta de spam).",
  };
}

export async function registrarConsentimientoCheckout(email: string): Promise<{ ok: boolean }> {
  if (!EMAIL_RE.test(email)) return { ok: false };
  await registrarConsentimiento({
    email,
    origen: "checkout",
    texto: TEXTO_CHECKOUT,
    estado: "confirmado",
  });
  return { ok: true };
}

export async function confirmarSuscripcion(token: string): Promise<{ ok: boolean; mensaje: string }> {
  if (!token) return { ok: false, mensaje: "Enlace de confirmación no válido." };
  const ok = await confirmarConsentimiento(token);
  return ok
    ? { ok: true, mensaje: "¡Suscripción confirmada! Ya recibirás nuestras ofertas y novedades." }
    : { ok: false, mensaje: "Este enlace ya no es válido (puede que la suscripción esté confirmada o dada de baja)." };
}

export async function darseDeBajaNewsletter(token: string): Promise<{ ok: boolean; mensaje: string }> {
  if (!token) return { ok: false, mensaje: "Enlace de baja no válido." };
  const ok = await darDeBaja(token);
  return {
    ok: true,
    mensaje: ok
      ? "Te has dado de baja. No recibirás más emails comerciales nuestros."
      : "Ya constabas como dado de baja. No recibirás más emails comerciales nuestros.",
  };
}
