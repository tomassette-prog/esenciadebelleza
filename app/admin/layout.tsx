import { cookies } from "next/headers";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import Link from "next/link";
import { type ReactNode } from "react";

// Emails con acceso admin
const ADMIN_EMAILS = ["ziarresamot@gmail.com"];

async function getAdminUser(): Promise<{ email: string } | null> {
  const cookieStore = await cookies();
  
  // Intentar leer el token desde la cookie que escribe createBrowserClient
  const projectRef = "yjanobsfzcwpusynvlun";
  const cookieName = `sb-${projectRef}-auth-token`;
  
  // También puede estar en chunks .0, .1...
  let tokenValue = cookieStore.get(cookieName)?.value;
  if (!tokenValue) {
    const chunk0 = cookieStore.get(`${cookieName}.0`)?.value;
    if (chunk0) {
      let i = 0;
      let combined = "";
      while (true) {
        const chunk = cookieStore.get(`${cookieName}.${i}`)?.value;
        if (!chunk) break;
        combined += chunk;
        i++;
      }
      tokenValue = combined;
    }
  }

  if (!tokenValue) return null;

  try {
    const parsed = JSON.parse(tokenValue);
    const accessToken: string = parsed.access_token;
    if (!accessToken) return null;

    // Decodificar el JWT para obtener el sub (user id)
    const payloadB64 = accessToken.split(".")[1];
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString());
    const userId: string = payload.sub;
    if (!userId) return null;

    // Verificar con el servicio admin de Supabase
    const adminClient = createSupabaseAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    const { data: { user } } = await adminClient.auth.admin.getUserById(userId);
    return user ? { email: user.email ?? "" } : null;
  } catch {
    return null;
  }
}

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await getAdminUser();

  if (!user || !ADMIN_EMAILS.includes(user.email)) {
    redirect("/login?redirectTo=/admin/productos");
  }


  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Barra de navegación admin */}
      <nav className="bg-neutral-900 text-white">
        <div className="container-main flex items-center gap-8 h-12">
          <Link
            href="/"
            className="text-xs tracking-widest uppercase text-neutral-400 hover:text-white transition-colors"
          >
            ← Tienda
          </Link>
          <div className="w-px h-4 bg-neutral-700" />
          <span className="text-xs tracking-widest uppercase" style={{ color: "var(--color-oro)" }}>
            Admin
          </span>
          <div className="flex items-center gap-6 ml-2">
            <Link
              href="/admin/carruseles"
              className="text-xs tracking-widest uppercase text-neutral-300 hover:text-white transition-colors"
            >
              Carruseles
            </Link>
            <Link
              href="/admin/productos"
              className="text-xs tracking-widest uppercase text-neutral-300 hover:text-white transition-colors"
            >
              Productos
            </Link>
            <Link
              href="/admin/stock"
              className="text-xs tracking-widest uppercase text-neutral-300 hover:text-white transition-colors"
            >
              Stock
            </Link>
            <Link
              href="/admin/envios"
              className="text-xs tracking-widest uppercase text-neutral-300 hover:text-white transition-colors"
            >
              Envíos
            </Link>
            <Link
              href="/admin/blog"
              className="text-xs tracking-widest uppercase text-neutral-300 hover:text-white transition-colors"
            >
              Blog
            </Link>
            <Link
              href="/admin/pedidos"
              className="text-xs tracking-widest uppercase text-neutral-300 hover:text-white transition-colors"
            >
              Pedidos
            </Link>
            <Link
              href="/admin/profesionales"
              className="text-xs tracking-widest uppercase text-neutral-300 hover:text-white transition-colors"
            >
              Profesionales
            </Link>
            <Link
              href="/admin/importar"
              className="text-xs tracking-widest uppercase text-neutral-300 hover:text-white transition-colors"
            >
              Importar
            </Link>
            <Link
              href="/admin/categorias"
              className="text-xs tracking-widest uppercase text-neutral-300 hover:text-white transition-colors"
            >
              Categorías
            </Link>
            <Link
              href="/admin/marcas"
              className="text-xs tracking-widest uppercase text-neutral-300 hover:text-white transition-colors"
            >
              Marcas
            </Link>
            <Link
              href="/admin/resenas"
              className="text-xs tracking-widest uppercase text-neutral-300 hover:text-white transition-colors"
            >
              Reseñas
            </Link>
          </div>
        </div>
      </nav>

      {/* Contenido */}
      <div className="container-main py-8">
        {children}
      </div>
    </div>
  );
}
