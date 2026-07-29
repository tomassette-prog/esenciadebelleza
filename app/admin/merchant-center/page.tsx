import MerchantCenterUploadSimple from "@/components/admin/MerchantCenterUploadSimple";
import MerchantDiagnostico from "@/components/admin/MerchantDiagnostico";

export default function MerchantCenterPage() {
  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900">🛒 Google Merchant Center</h1>
        <p className="text-gray-600 mt-2 text-lg">
          Diagnóstico y corrección de productos para Google Shopping.
        </p>
      </div>

      {/* Diagnóstico de productos problemáticos */}
      <div className="mb-10">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">📊 Diagnóstico de productos</h2>
        <MerchantDiagnostico />
      </div>

      <hr className="my-8 border-gray-200" />

      {/* Corrección manual por CSV */}
      <div>
        <h2 className="text-xl font-semibold text-gray-800 mb-4">📋 Corregir desde CSV de Google</h2>
        <MerchantCenterUploadSimple />
      </div>
    </div>
  );
}
