import MerchantCenterUpload from "@/components/admin/MerchantCenterUpload";

export default function MerchantCenterPage() {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Google Merchant Center</h1>
        <p className="text-gray-600 mt-2">
          Procesa CSVs de errores de Google para enriquecer automáticamente descripciones de productos.
        </p>
      </div>

      <MerchantCenterUpload />
    </div>
  );
}
