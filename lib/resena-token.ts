import { createHmac, timingSafeEqual } from "crypto";

// Signed tokens for guest review links (email + product + order). The secret
// is derived from the service role key so no extra env var is required.

const SECRETO = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "sin-clave";

function firmar(datos: string): string {
  return createHmac("sha256", SECRETO).update(datos).digest("hex").slice(0, 32);
}

export function crearTokenResena(p: {
  email: string;
  productoId: string;
  pedidoId: string;
}): string {
  const payload = `${p.email.toLowerCase()}|${p.productoId}|${p.pedidoId}`;
  const datos = Buffer.from(payload).toString("base64url");
  return `${datos}.${firmar(payload)}`;
}

export function verificarTokenResena(
  token: string,
  p: { email: string; productoId: string; pedidoId: string }
): boolean {
  const [datos, firma] = token.split(".");
  if (!datos || !firma) return false;
  let payload: string;
  try {
    payload = Buffer.from(datos, "base64url").toString("utf8");
  } catch {
    return false;
  }
  const esperado = firmar(payload);
  const a = Buffer.from(firma);
  const b = Buffer.from(esperado);
  if (a.length !== b.length) return false;
  if (!timingSafeEqual(a, b)) return false;
  return payload === `${p.email.toLowerCase()}|${p.productoId}|${p.pedidoId}`;
}

/** Decodes the payload without verifying (for rendering the form). */
export function leerTokenResena(token: string): { email: string; productoId: string; pedidoId: string } | null {
  const [datos] = token.split(".");
  if (!datos) return null;
  try {
    const [email, productoId, pedidoId] = Buffer.from(datos, "base64url").toString("utf8").split("|");
    if (!email || !productoId || !pedidoId) return null;
    return { email, productoId, pedidoId };
  } catch {
    return null;
  }
}
