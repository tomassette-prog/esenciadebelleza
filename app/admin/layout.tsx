import { redirect } from "next/navigation";
import { type ReactNode } from "react";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const ADMIN_EMAILS = ["ziarresamot@gmail.com"];

export const maxDuration = 300;

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.user) {
    redirect("/login?redirectTo=/admin/productos");
  }

  // El email viene en el JWT de sesión; el admin client lo confirma como doble verificación
  const sessionEmail = session.user.email ?? "";
  let verifiedEmail = sessionEmail;

  try {
    const adminClient = createAdminClient();
    const { data: { user } } = await adminClient.auth.admin.getUserById(session.user.id);
    if (user?.email) verifiedEmail = user.email;
  } catch {
    // Si el admin client falla, usar el email del JWT (ya validado por Supabase SSR)
  }

  if (!ADMIN_EMAILS.includes(verifiedEmail)) {
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
