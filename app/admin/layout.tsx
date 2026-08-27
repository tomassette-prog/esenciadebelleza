import { redirect } from "next/navigation";
import { type ReactNode } from "react";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const ADMIN_EMAILS = ["ziarresamot@gmail.com"];

export const maxDuration = 300;

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  // getSession() lee las cookies locales sin red; suficiente para obtener el user ID
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.user?.id) {
    redirect("/login?redirectTo=/admin/productos");
  }

  // Verificar email contra la whitelist usando service_role (fuente de verdad)
  const adminClient = createAdminClient();
  const { data: { user } } = await adminClient.auth.admin.getUserById(session.user.id);

  if (!user || !ADMIN_EMAILS.includes(user.email ?? "")) {
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
