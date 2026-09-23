import { redirect } from "next/navigation";
import { type ReactNode } from "react";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { getSessionFromCookie } from "@/lib/supabase/session-helper";

const ADMIN_EMAILS = ["ziarresamot@gmail.com"];

export const maxDuration = 300;

export default async function AdminLayout({ children }: { children: ReactNode }) {
  // Sesión VERIFICADA por JWT contra Supabase (el JSON de la cookie es forjable)
  const session = await getSessionFromCookie();
  const email = session?.email ?? null;

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
