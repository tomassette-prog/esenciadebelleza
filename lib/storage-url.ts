const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://yjanobsfzcwpusynvlun.supabase.co";

// Normaliza rutas relativas (/storage/...) a URL absoluta de Supabase Storage
export function urlStoragePublica(u: string | null): string | null {
  if (!u) return null;
  return u.startsWith("/") ? SUPABASE_URL + u : u;
}
