import { cookies } from "next/headers";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { type ReactNode } from "react";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

export const maxDuration = 300;

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
    <div className="min-h-screen bg-neutral-50 flex">
      {/* Sidebar */}
      <AdminSidebar />

      {/* Contenido */}
      <main className="flex-1 min-w-0 py-8 px-8">
        {children}
      </main>
    </div>
  );
}
