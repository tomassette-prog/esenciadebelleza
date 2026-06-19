import type { Metadata } from "next";
import { ImportarPanel } from "@/components/admin/ImportarPanel";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Importar catálogo | Admin",
  robots: { index: false, follow: false },
};

export default function ImportarPage() {
  return (
    <div className="max-w-4xl">
      <ImportarPanel />
    </div>
  );
}
