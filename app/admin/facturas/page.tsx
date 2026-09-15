import type { Metadata } from "next";
import FacturasAdmin from "@/components/admin/FacturasAdmin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Facturas | Admin",
  robots: { index: false, follow: false },
};

export default function AdminFacturasPage() {
  return <FacturasAdmin />;
}
