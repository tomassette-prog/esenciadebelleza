import type { Metadata } from "next";
import Link from "next/link";
import { PackForm } from "../PackForm";

export const metadata: Metadata = {
  title: "Nuevo pack | Admin",
  robots: { index: false, follow: false },
};

export default function NuevoPackPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Link href="/admin/packs" className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs border border-neutral-300 text-neutral-600 hover:border-neutral-600 hover:text-neutral-900 transition-colors">
          ← Volver
        </Link>
        <span className="text-neutral-300">/</span>
        <span className="text-sm text-neutral-600">Nuevo pack</span>
      </div>
      <PackForm />
    </div>
  );
}
