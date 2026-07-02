import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPackAdminById } from "@/actions/packs";
import { PackForm } from "../PackForm";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const pack = await getPackAdminById(id);
  return {
    title: pack ? `${pack.nombre} | Admin` : "Editar pack | Admin",
    robots: { index: false, follow: false },
  };
}

export default async function EditarPackPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pack = await getPackAdminById(id);
  if (!pack) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/packs" className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs border border-neutral-300 text-neutral-600 hover:border-neutral-600 hover:text-neutral-900 transition-colors">
          ← Volver
        </Link>
        <span className="text-neutral-300">/</span>
        <span className="text-sm text-neutral-600 line-clamp-1">{pack.nombre}</span>
      </div>
      <PackForm pack={pack} />
    </div>
  );
}
