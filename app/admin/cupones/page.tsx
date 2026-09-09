import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import CuponesClient from "./CuponesClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Cupones | Admin",
  robots: { index: false, follow: false },
};

export default async function AdminCuponesPage() {
  const supabase = createAdminClient();

  const { data: cupones } = await supabase
    .from("cupones")
    .select("*")
    .order("created_at", { ascending: false });

  return <CuponesClient cuponesInitial={cupones ?? []} />;
}
