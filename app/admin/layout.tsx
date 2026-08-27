import { redirect } from "next/navigation";
import { type ReactNode } from "react";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { verificarAdmin } from "@/lib/admin-auth";

export const maxDuration = 300;

export default async function AdminLayout({ children }: { children: ReactNode }) {
  try {
    await verificarAdmin();
  } catch {
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
