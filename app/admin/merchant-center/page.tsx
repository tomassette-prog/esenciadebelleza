import MerchantCenterUploadSimple from "@/components/admin/MerchantCenterUploadSimple";

export default function MerchantCenterPage() {
  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900">🛒 Google Merchant Center</h1>
        <p className="text-gray-600 mt-2 text-lg">
          Mejora descripciones de productos basado en lo que Google sugiere que necesitan.
        </p>
      </div>

      <MerchantCenterUploadSimple />
    </div>
  );
}
