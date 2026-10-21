// Mirror of supplier product images in Supabase Storage ("imagen local").
// The daily import keeps writing the supplier URL into imagen_principal_url /
// imagen_url; the web shows imagen_local_url when present and falls back to the
// origin URL. imagen_origen_url records the copied source so a changed supplier
// image triggers a fresh copy and re-imports never lose the local mirror.

import type { SupabaseClient } from "@supabase/supabase-js";

export const BUCKET_IMAGENES = "productos";
export const ORIGEN_IMAGENES = "depeluqueriaproductos.com";

export function esImagenDeOrigen(url: string | null | undefined): boolean {
  return !!url && url.includes(ORIGEN_IMAGENES);
}

/** True when the row has no local copy yet or the supplier image changed. */
export function necesitaCopia(fila: {
  imagen_local_url: string | null;
  imagen_origen_url: string | null;
  origenActual: string | null;
}): boolean {
  if (!esImagenDeOrigen(fila.origenActual)) return false;
  return !fila.imagen_local_url || fila.imagen_origen_url !== fila.origenActual;
}

export function extDesdeUrl(urlStr: string): string {
  const ext = urlStr.split("?")[0].split(".").pop()?.toLowerCase() ?? "jpg";
  return ["jpg", "jpeg", "png", "webp", "gif"].includes(ext) ? ext : "jpg";
}

export function mimeDesdeUrl(urlStr: string): string {
  const ext = extDesdeUrl(urlStr);
  const map: Record<string, string> = {
    jpg: "image/jpeg", jpeg: "image/jpeg",
    png: "image/png", webp: "image/webp",
    gif: "image/gif",
  };
  return map[ext] ?? "image/jpeg";
}

export async function descargarImagen(urlStr: string): Promise<Buffer> {
  const res = await fetch(urlStr, {
    headers: { "User-Agent": "Mozilla/5.0 EsenciaDeBelleza/1.0" },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} al descargar ${urlStr}`);
  return Buffer.from(await res.arrayBuffer());
}

export async function subirImagen(
  supabase: SupabaseClient,
  buffer: Buffer,
  storagePath: string,
  mime: string
): Promise<string | null> {
  const { error } = await supabase.storage
    .from(BUCKET_IMAGENES)
    .upload(storagePath, buffer, { contentType: mime, upsert: true });
  if (error) {
    console.error(`    [ERROR storage] ${storagePath}:`, error.message);
    return null;
  }
  const { data } = supabase.storage.from(BUCKET_IMAGENES).getPublicUrl(storagePath);
  return data.publicUrl ?? null;
}

export async function asegurarBucket(supabase: SupabaseClient): Promise<void> {
  const { data: buckets } = await supabase.storage.listBuckets();
  const existe = buckets?.some((b) => b.name === BUCKET_IMAGENES);
  if (!existe) {
    const { error } = await supabase.storage.createBucket(BUCKET_IMAGENES, { public: true });
    if (error) throw new Error(`No se pudo crear el bucket "${BUCKET_IMAGENES}": ${error.message}`);
  }
}

export function rutaImagenPadre(slug: string, urlOrigen: string): string {
  return `padres/${slug}.${extDesdeUrl(urlOrigen)}`;
}

export function rutaImagenVariacion(slugPadre: string, nombreVariacion: string, urlOrigen: string): string {
  const slugVariacion = (nombreVariacion ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `variaciones/${slugPadre}--${slugVariacion}.${extDesdeUrl(urlOrigen)}`;
}

/**
 * Copies one supplier image into the bucket and records it in the mirror
 * columns (imagen_local_url + imagen_origen_url). Never touches the origin
 * column, so the daily import keeps its data intact.
 */
export async function copiarImagen(
  supabase: SupabaseClient,
  tabla: "productos_padre" | "productos_variaciones",
  fila: { id: string; origenActual: string | null },
  storagePath: string
): Promise<"copiada" | "error"> {
  const urlOrigen = fila.origenActual;
  if (!urlOrigen) return "error";
  try {
    const buffer = await descargarImagen(urlOrigen);
    const nuevaUrl = await subirImagen(supabase, buffer, storagePath, mimeDesdeUrl(urlOrigen));
    if (!nuevaUrl) return "error";
    const { error } = await supabase
      .from(tabla)
      .update({ imagen_local_url: nuevaUrl, imagen_origen_url: urlOrigen })
      .eq("id", fila.id);
    return error ? "error" : "copiada";
  } catch (e) {
    console.error(`    [ERROR copia] ${storagePath}:`, (e as Error).message);
    return "error";
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
