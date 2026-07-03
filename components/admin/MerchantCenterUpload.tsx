"use client";

import { useState, useRef } from "react";
import Papa from "papaparse";
import { procesarLoteGoogleMerchant, EnriquecerProductoInput } from "@/actions/merchant-center";

export default function MerchantCenterUpload() {
  const [cargando, setCargando] = useState(false);
  const [resultado, setResultado] = useState<any>(null);
  const [error, setError] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError("");
    setResultado(null);
    setCargando(true);

    try {
      // Leer archivo CSV
      const text = await file.text();

      // Parsear CSV con PapaParse
      const parseResult = Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: false,
      });

      const records: any[] = parseResult.data;

      console.log(`📊 CSV parseado: ${records.length} productos`);

      // Filtrar solo productos sin descripción o incompletos
      const productosIncompletos: EnriquecerProductoInput[] = records
        .filter(
          (r: any) =>
            (!r.Descripción || r.Descripción.trim() === "") &&
            r["Añadir a la descripción"]
        )
        .map((r: any) => ({
          productoId: r["ID de producto"],
          nombre: r.Producto,
          descripcionActual: r.Descripción || undefined,
          queAgregar: r["Añadir a la descripción"],
        }));

      if (productosIncompletos.length === 0) {
        setError("No se encontraron productos con descripciones incompletas.");
        setCargando(false);
        return;
      }

      console.log(`🔍 Productos a enriquecer: ${productosIncompletos.length}`);

      // Procesar lote
      const res = await procesarLoteGoogleMerchant(productosIncompletos);

      setResultado({
        totalProcesados: productosIncompletos.length,
        exitosos: res.exitosos,
        fallidos: res.fallidos,
        detalles: res.detalles,
      });

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (err) {
      setError(`Error al procesar archivo: ${String(err)}`);
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">📥 Google Merchant Center Fix</h3>
        <p className="text-blue-800 text-sm mb-4">
          Carga un CSV descargado de Google Merchant Center. El sistema automáticamente:
        </p>
        <ul className="text-blue-800 text-sm space-y-1 ml-4 list-disc">
          <li>Identifica productos sin descripción</li>
          <li>Genera descripciones enriquecidas con IA (Fórmula, Ingrediente, Beneficios)</li>
          <li>Actualiza Supabase automáticamente</li>
        </ul>
      </div>

      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFileChange}
          disabled={cargando}
          className="hidden"
          id="merchant-csv"
        />
        <label
          htmlFor="merchant-csv"
          className={`cursor-pointer ${cargando ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          <div className="text-4xl mb-2">📄</div>
          <p className="font-semibold text-gray-700">
            {cargando ? "Procesando..." : "Haz clic para cargar CSV"}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            O arrastra el archivo aquí
          </p>
        </label>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {resultado && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-3">
          <h3 className="font-semibold text-green-900">✅ Procesamiento completado</h3>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-green-700">Total procesados</p>
              <p className="text-2xl font-bold text-green-900">{resultado.totalProcesados}</p>
            </div>
            <div>
              <p className="text-green-700">Exitosos</p>
              <p className="text-2xl font-bold text-green-900">{resultado.exitosos}</p>
            </div>
          </div>

          {resultado.fallidos > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
              <p className="text-yellow-800 text-sm font-semibold">⚠️ {resultado.fallidos} fallidos:</p>
              <div className="text-yellow-700 text-sm mt-2 space-y-1 max-h-40 overflow-y-auto">
                {resultado.detalles
                  .filter((d: any) => !d.ok)
                  .map((d: any, idx: number) => (
                    <div key={idx} className="text-xs">
                      {d.error}
                    </div>
                  ))}
              </div>
            </div>
          )}

          <button
            onClick={() => setResultado(null)}
            className="mt-4 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm font-semibold"
          >
            Procesar otro archivo
          </button>
        </div>
      )}
    </div>
  );
}
