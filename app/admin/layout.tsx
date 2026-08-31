import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { type ReactNode } from "react";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

const ADMIN_EMAILS = ["ziarresamot@gmail.com"];
const PROJECT_REF = "yjanobsfzcwpusynvlun";

export const maxDuration = 300;

async function getSessionEmail(): Promise<string | null> {
  const cookieStore = await cookies();
  const cookieName = `sb-${PROJECT_REF}-auth-token`;

  // Leer cookie completa o reconstruir desde chunks
  let raw = cookieStore.get(cookieName)?.value ?? "";
  if (!raw) {
    for (let i = 0; ; i++) {
      const chunk = cookieStore.get(`${cookieName}.${i}`)?.value;
      if (!chunk) break;
      raw += chunk;
    }
  }
  if (!raw) return null;

  try {
    // Next.js puede devolver el valor URL-encoded
    const decoded = raw.startsWith("%") ? decodeURIComponent(raw) : raw;
    const parsed = JSON.parse(decoded);
    // El email está en parsed.user.email (session object de Supabase)
    return parsed?.user?.email ?? null;
  } catch {
    return null;
  }
}

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const email = await getSessionEmail();

  if (!email || !ADMIN_EMAILS.includes(email)) {
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
