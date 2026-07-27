import type { Metadata } from "next";
import { ImportarPanel } from "@/components/admin/ImportarPanel";
import MerchantCenterUploadSimple from "@/components/admin/MerchantCenterUploadSimple";
import { getAllCategoriaPairs } from "@/lib/category-suggester";
import { SuspenseSyncTabs } from "./SyncTabsClient";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export const metadata: Metadata = {
  title: "Sincronización | Admin",
  robots: { index: false, follow: false },
};

export default async function SincronizacionPage() {
  const allPairs = await getAllCategoriaPairs();

  return (
    <div className="max-w-6xl">
      <SuspenseSyncTabs>
        <div data-tab="importar">
          <ImportarPanel allPairs={allPairs} />
        </div>
        <div data-tab="merchant">
          <MerchantCenterUploadSimple />
        </div>
      </SuspenseSyncTabs>
    </div>
  );
}
