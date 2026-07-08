import type { Metadata } from "next";
import { ImportarPanel } from "@/components/admin/ImportarPanel";
import { getAllCategoriaPairs } from "@/lib/category-suggester";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export const metadata: Metadata = {
  title: "Importar catálogo | Admin",
  robots: { index: false, follow: false },
};

export default async function ImportarPage() {
  const allPairs = await getAllCategoriaPairs();
  
  return (
    <div className="max-w-4xl">
      <ImportarPanel allPairs={allPairs} />
    </div>
  );
}
