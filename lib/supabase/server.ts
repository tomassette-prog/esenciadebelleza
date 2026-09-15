import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const PROJECT_REF = "yjanobsfzcwpusynvlun";
const AUTH_COOKIE = `sb-${PROJECT_REF}-auth-token`;

// Cliente para uso en Server Components, Route Handlers y Server Actions
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          const all = cookieStore.getAll();

          // Reensamblar cookies fragmentadas de Supabase (.0, .1, .2...)
          const chunked = new Map<string, string[]>();
          for (const c of all) {
            const match = c.name.match(/^(sb-.+?-auth-token)\.(\d+)$/);
            if (match) {
              const base = match[1];
              const idx = parseInt(match[2], 10);
              if (!chunked.has(base)) chunked.set(base, []);
              chunked.get(base)![idx] = c.value;
            }
          }

          // Reemplazar cookies chunked por una sola cookie reensamblada
          const result = all.filter(c => !/^sb-.+?-auth-token\.\d+$/.test(c.name));
          for (const [base, chunks] of chunked) {
            const assembled = chunks.join("");
            const decoded = assembled.startsWith("%") ? decodeURIComponent(assembled) : assembled;
            result.push({ name: base, value: decoded });
          }

          return result;
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // En Server Components el set no es posible — se ignora
          }
        },
      },
    }
  );
}
