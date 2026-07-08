"use client";

import { useState, useRef } from "react";
import Papa from "papaparse";
import { procesarLoteGoogleMerchant, EnriquecerProductoInput } from "@/actions/merchant-center";

export default function MerchantCenterUpload() {
  const [cargando, setCargando] = useState(false);
  const [resultado, setResultado] = useState<any>(null);
  const [error, setError] = useState<string>("");
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const procesarArchivo = async (file: File) => {
    if (!file.name.endsWith(".csv")) {
      setError("Por favor, selecciona un archivo CSV.");
      return;
    }

    setError("");
    setResultado(null);
    setCargando(true);

    try {
      // Leer archivo CSV
      const text = await file.text();
      
      console.log(`📄 Primeras 500 caracteres del archivo:`, text.substring(0, 500));

      // Detectar delimitador (tabulación > punto y coma > coma)
      const line1 = text.split('\n')[0];
      let delimiter = ',';
      
      // Contar delimitadores potenciales en la primera línea
      const tabCount = (line1.match(/\t/g) || []).length;
      const semicolonCount = (line1.match(/;/g) || []).length;
      const commaCount = (line1.match(/,/g) || []).length;
      
      // Priorizar: tabulación > punto y coma > coma
      if (tabCount > 0) {
        delimiter = '\t';
      } else if (semicolonCount > 0 && semicolonCount >= commaCount) {
        delimiter = ';';
      } else {
        delimiter = ',';
      }
      
      console.log(`🔍 Delimitador detectado: '${delimiter === '\t' ? 'TAB' : delimiter}' (TAB: ${tabCount}, ;: ${semicolonCount}, ,: ${commaCount})`);

      // Parsear CSV con PapaParse
      const parseResult = Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: false,
        delimiter: delimiter,
      });

      const records: any[] = parseResult.data;

      console.log(`📊 CSV parseado: ${records.length} filas`);
      console.log(`📋 Headers detectados:`, Object.keys(records[0] || {}));
      console.log(`📝 Primera fila:`, records[0]);

      if (records.length === 0) {
        setError("El archivo CSV está vacío.");
        setCargando(false);
        return;
      }

      // Detectar headers de forma flexible (insensible a mayúsculas y espacios)
      const firstRow = records[0];
      const headers = Object.keys(firstRow);
      
      // Si tenemos una sola columna Y es muy larga, probablemente es mal delimitado
      if (headers.length === 1 && headers[0].length > 50) {
        // Intentar con delimitador alternativo
        const allDelimiters = [';', '\t', ','];
        let foundBetter = false;
        
        for (const altDelim of allDelimiters) {
          if (altDelim === delimiter) continue;
          const altResult = Papa.parse(text, {
            header: true,
            skipEmptyLines: true,
            dynamicTyping: false,
            delimiter: altDelim,
          });
          const altRecords = altResult.data as any[];
          const altHeaders = Object.keys(altRecords[0] || {});
          
          if (altHeaders.length > 1 && altHeaders.some(h => h.length < 50)) {
            // Encontramos mejor delimitador
            delimiter = altDelim;
            records.length = 0;
            records.push(...altRecords);
            foundBetter = true;
            console.log(`✅ Re-parsing con delimitador '${altDelim === '\t' ? 'TAB' : altDelim}'`);
            break;
          }
        }
        
        if (!foundBetter) {
          setError(`❌ El CSV parece tener un formato incorrecto.
        
Headers detectados: ${headers.join(', ')}

Posibles problemas:
1. El archivo no es un CSV válido - parece tener una sola columna muy larga
2. El delimitador es diferente (probamos: coma, punto y coma, tabulación)
3. El archivo es XLS/XLSX exportado incorrectamente como texto

💡 Solución: 
- Asegúrate de descargar desde Google Merchant Center como "CSV"
- Si usas Excel, guarda como "CSV (delimitado por comas)" o "CSV (delimitado por tabulaciones)"
- No uses archivos XLS o XLSX directamente - abre en Excel y guarda como CSV
- Verifica que el archivo contenga las columnas correctas`);
          setCargando(false);
          return;
        }
      }
      
      // Si los headers parecen datos (muy largos o con descripción), probablemente es mal formato
      const reprocessedHeaders = Object.keys(records[0] || {});
      if (reprocessedHeaders.some(h => h.length > 100)) {
        setError(`❌ El CSV parece tener un formato incorrecto.
        
Headers detectados: ${reprocessedHeaders.join(', ')}

Posibles problemas:
1. El archivo no es un CSV válido
2. Usa un delimitador no estándar (verificamos: coma, punto y coma, tabulación)
3. El archivo tiene formato de Excel sin exportar correctamente

💡 Solución: 
- Asegúrate de descargar desde Google Merchant Center como "CSV"
- Si usas Excel, guarda como "CSV (delimitado por comas)" o "CSV (delimitado por tabulaciones)"
- No uses archivos XLS o XLSX`);
        setCargando(false);
        return;
      }

      // Normalizar headers para búsqueda
      const normalizar = (h: string) => h.toLowerCase().trim().replace(/\s+/g, " ");
      
      // Buscar columns dinámicamente
      const findColumn = (keywords: string[]) => {
        return headers.find(h => 
          keywords.some(k => normalizar(h).includes(normalizar(k)) || normalizar(k).includes(normalizar(h)))
        );
      };

      const colProductoId = findColumn(["id de producto", "product id", "id", "sku"]);
      const colProducto = findColumn(["producto", "title", "product name", "nombre"]);
      const colDescripcion = findColumn(["descripción", "description", "desc"]);
      const colQueAgregar = findColumn(["añadir", "add to description", "agregar", "additional", "corrige"]);

      console.log(`🔍 Columnas detectadas:`, {
        productoId: colProductoId,
        producto: colProducto,
        descripcion: colDescripcion,
        queAgregar: colQueAgregar,
      });

      if (!colProductoId || !colProducto || !colQueAgregar) {
        const missingCols = [];
        if (!colProductoId) missingCols.push("ID de producto / product id");
        if (!colProducto) missingCols.push("Producto / title");
        if (!colQueAgregar) missingCols.push("Añadir a la descripción / add to description");

        setError(
          `❌ Columnas requeridas no encontradas en el CSV.
          
Detectadas: ${headers.join(" | ")}

Faltantes: ${missingCols.join(", ")}

El CSV debe tener al menos estas columnas:
- ID o código del producto
- Nombre del producto
- Descripción o sugerencias qué agregar

💡 Si descargaste desde Google Merchant Center:
1. Ve a Google Merchant Center
2. Haz clic en "Productos"
3. Usa el filtro para "Errores de feed"
4. Descarga el CSV usando el botón "Exportar"`
        );
        setCargando(false);
        return;
      }

      // Filtrar solo productos con "Añadir a la descripción" no vacío
      const productosIncompletos: EnriquecerProductoInput[] = records
        .filter((r: any) => {
          if (!colQueAgregar) return false;
          const queAgregar = r[colQueAgregar]?.trim();
          return queAgregar && queAgregar.length > 0;
        })
        .map((r: any) => {
          const id = String(r[colProductoId!]).trim();
          const nombre = String(r[colProducto!]).trim();
          const desc = colDescripcion ? String(r[colDescripcion]).trim() : undefined;
          const agregar = String(r[colQueAgregar!]).trim();

          console.log(`  ✓ ${nombre} (${id}): agregar "${agregar}"`);

          return {
            productoId: id,
            nombre: nombre,
            descripcionActual: desc || undefined,
            queAgregar: agregar,
          };
        });

      if (productosIncompletos.length === 0) {
        setError(
          `❌ No se encontraron productos con datos en la columna "${colQueAgregar}".
          
Verifica que el CSV tenga productos con información que agregar a la descripción.

📊 Detectamos ${records.length} filas, pero ninguna tiene datos en "${colQueAgregar}"`
        );
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
      setError(`❌ Error al procesar archivo: ${String(err)}`);
    } finally {
      setCargando(false);
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await procesarArchivo(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    await procesarArchivo(file);
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

      <div 
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
          dragActive
            ? "border-blue-500 bg-blue-50"
            : "border-gray-300 hover:border-gray-400"
        } ${cargando ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
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
          className={`cursor-pointer block ${cargando ? "opacity-50 cursor-not-allowed" : ""}`}
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
          <p className="text-red-800 whitespace-pre-wrap text-sm font-mono">{error}</p>
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
