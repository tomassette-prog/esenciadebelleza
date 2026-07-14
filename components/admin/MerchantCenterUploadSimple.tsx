'use client';

import { useState } from 'react';
import { enriquecerProducto, corregirLoteMerchant } from '@/actions/merchant-center';

interface Producto {
  nombre: string;
  descripcionActual: string;
  queAgregar: string;
  descripcionGenerada?: string;
  corregido?: boolean;
  error?: string;
}

export default function MerchantCenterUploadSimple() {
  const [csvText, setCsvText] = useState('');
  const [productos, setProductos] = useState<Producto[]>([]);
  const [generando, setGenerando] = useState<Set<number>>(new Set());
  const [corrigiendoTodo, setCorrigiendoTodo] = useState(false);
  const [progreso, setProgreso] = useState(0);
  const [resumenLote, setResumenLote] = useState<{ exitosos: number; fallidos: number } | null>(null);

  const handleParsear = () => {
    if (!csvText.trim()) {
      alert('Pega el CSV primero');
      return;
    }

    const prods = parseCSV(csvText);
    if (prods.length === 0) {
      alert('No se encontraron productos. Verifica el formato del CSV de Google Merchant Center.');
      return;
    }

    setProductos(prods);
    setResumenLote(null);
    setProgreso(0);
  };

  const handleGenerar = async (index: number) => {
    const prod = productos[index];
    setGenerando(prev => new Set(prev).add(index));

    try {
      const res = await enriquecerProducto({
        productoId: `manual_${index}`,
        nombre: prod.nombre,
        descripcionActual: prod.descripcionActual,
        queAgregar: prod.queAgregar,
      });

      const nuevos = [...productos];
      if (res.ok && res.descripcionGenerada) {
        nuevos[index].descripcionGenerada = res.descripcionGenerada;
        nuevos[index].corregido = true;
      } else {
        nuevos[index].error = res.error || 'Error generando descripción';
      }
      setProductos(nuevos);
    } catch (err) {
      const nuevos = [...productos];
      nuevos[index].error = err instanceof Error ? err.message : 'Error';
      setProductos(nuevos);
    } finally {
      setGenerando(prev => {
        const s = new Set(prev);
        s.delete(index);
        return s;
      });
    }
  };

  const handleCorregirTodo = async () => {
    if (!productos.length) return;
    setCorrigiendoTodo(true);
    setProgreso(0);
    setResumenLote(null);

    const pendientes = productos
      .map((p, i) => ({ prod: p, idx: i }))
      .filter(({ prod }) => !prod.corregido);

    const nuevos = [...productos];
    let exitosos = 0;
    let fallidos = 0;

    for (let i = 0; i < pendientes.length; i++) {
      const { prod, idx } = pendientes[i];
      try {
        const res = await corregirLoteMerchant([{
          nombre: prod.nombre,
          tipoError: prod.queAgregar,
        }]);
        const detalle = res.detalles[0];
        if (detalle.ok) {
          nuevos[idx].corregido = true;
          nuevos[idx].error = undefined;
          if (detalle.accion === 'availability') {
            nuevos[idx].descripcionGenerada = '✓ Disponibilidad activada';
          }
          exitosos++;
        } else {
          nuevos[idx].error = detalle.error || 'Error desconocido';
          fallidos++;
        }
      } catch (err) {
        nuevos[idx].error = err instanceof Error ? err.message : 'Error';
        fallidos++;
      }
      setProductos([...nuevos]);
      setProgreso(Math.round(((i + 1) / pendientes.length) * 100));
    }

    setResumenLote({ exitosos, fallidos });
    setCorrigiendoTodo(false);
  };

  const pendientes = productos.filter(p => !p.corregido).length;
  const corregidos = productos.filter(p => p.corregido).length;

  // Detecta si todos los errores son de disponibilidad
  const esErrorDisponibilidad = productos.length > 0 &&
    productos.every(p => p.queAgregar.toLowerCase().includes('availability'));

  return (
    <div className="space-y-6 max-w-4xl">
      {/* PASO 1: Pegar CSV */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold mb-4">📋 Paso 1: Carga el CSV de Google Merchant Center</h2>

        {/* Subir archivo */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Subir archivo CSV
          </label>
          <input
            type="file"
            accept=".csv,.tsv,.txt"
            onChange={e => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = ev => setCsvText(ev.target?.result as string ?? '');
              reader.readAsText(file, 'UTF-8');
            }}
            className="block w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-blue-50 file:text-blue-700 file:font-semibold hover:file:bg-blue-100 cursor-pointer"
          />
        </div>

        {/* Separador */}
        <div className="flex items-center gap-3 my-4">
          <div className="flex-1 border-t border-gray-200" />
          <span className="text-xs text-gray-400 uppercase">o pega el contenido</span>
          <div className="flex-1 border-t border-gray-200" />
        </div>

        <textarea
          value={csvText}
          onChange={e => setCsvText(e.target.value)}
          placeholder={`Pega aquí el CSV exportado desde Google Merchant Center (diagnóstico de productos con errores)`}
          className="w-full h-48 p-3 border rounded font-mono text-sm"
        />

        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={handleParsear}
            disabled={!csvText.trim()}
            className="px-6 py-2 bg-blue-600 text-white rounded font-semibold hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            ✓ Parsear CSV
          </button>
          {csvText.trim() && (
            <span className="text-xs text-gray-500">{csvText.trim().split('\n').length} líneas cargadas</span>
          )}
        </div>

        {productos.length > 0 && (
          <p className="mt-2 text-sm text-gray-600">
            ✅ {productos.length} productos con errores encontrados
          </p>
        )}
      </div>

      {/* PASO 2: Corregir errores */}
      {productos.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">
              🔧 Paso 2: Corregir errores
            </h2>
            <span className="text-sm text-gray-500">
              {corregidos}/{productos.length} corregidos
            </span>
          </div>

          {/* Banner tipo de error */}
          {esErrorDisponibilidad && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-300 rounded text-sm text-amber-800">
              ⚠️ Todos los errores son de <strong>disponibilidad</strong> (availability). El botón &quot;Corregir todo&quot; activará los productos en Supabase.
            </div>
          )}

          {/* Botón Corregir Todo */}
          {pendientes > 0 && (
            <div className="mb-6">
              <button
                onClick={handleCorregirTodo}
                disabled={corrigiendoTodo}
                className="px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {corrigiendoTodo ? (
                  <>⏳ Corrigiendo... ({progreso}%)</>
                ) : (
                  <>⚡ Corregir todo ({pendientes} pendientes)</>
                )}
              </button>

              {corrigiendoTodo && (
                <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progreso}%` }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Resumen tras corregir todo */}
          {resumenLote && (
            <div className={`mb-4 p-4 rounded border ${resumenLote.fallidos === 0 ? 'bg-green-50 border-green-300' : 'bg-yellow-50 border-yellow-300'}`}>
              <p className="font-semibold">
                ✅ {resumenLote.exitosos} corregidos
                {resumenLote.fallidos > 0 && ` · ❌ ${resumenLote.fallidos} con error`}
              </p>
            </div>
          )}

          {/* Lista de productos */}
          <div className="space-y-2">
            {productos.map((prod, idx) => (
              <div
                key={idx}
                className={`border rounded p-3 ${prod.corregido ? 'bg-green-50 border-green-200' : prod.error ? 'bg-red-50 border-red-200' : 'bg-gray-50'}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800 text-sm truncate">{prod.nombre}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Error: {prod.queAgregar || 'N/A'}
                    </p>
                    {prod.descripcionGenerada && (
                      <p className="text-xs text-green-700 mt-1">{prod.descripcionGenerada}</p>
                    )}
                    {prod.error && (
                      <p className="text-xs text-red-600 mt-1">❌ {prod.error}</p>
                    )}
                  </div>

                  <div className="flex-shrink-0">
                    {prod.corregido ? (
                      <span className="text-green-600 text-lg">✓</span>
                    ) : (
                      <button
                        onClick={() => handleGenerar(idx)}
                        disabled={generando.has(idx) || corrigiendoTodo}
                        className="px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 disabled:bg-gray-400"
                      >
                        {generando.has(idx) ? '⏳' : 'Corregir'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function splitCSVLine(line: string, delimiter: string): string[] {
  if (delimiter !== ',') return line.split(delimiter).map(v => v.trim());
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function parseCSV(content: string): Producto[] {
  const lines = content
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.toLowerCase().startsWith('feed'));

  if (lines.length < 2) return [];

  // Detecta delimitador
  const firstLine = lines[0];
  let delimiter = ',';
  if (firstLine.includes('\t')) delimiter = '\t';
  else if (firstLine.includes(';')) delimiter = ';';

  // Parse headers - busca columnas clave
  const headers = splitCSVLine(firstLine, delimiter).map(h =>
    h.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  );
  // Merchant Center export uses "titulo" (normalized from "Título")
  const prodIdx = headers.findIndex(h =>
    h.includes('titulo') || h.includes('producto') || h.includes('product') || h.includes('title') || h.includes('nombre')
  );
  const descIdx = headers.findIndex(h =>
    h.includes('descripcion') || h.includes('description')
  );
  // Merchant Center: "nombre del problema" tells us what's missing (e.g. "Falta el valor [availability]")
  const problemIdx = headers.findIndex(h => h.includes('nombre del problema') || h.includes('problema'));
  const addIdx = headers.findIndex(h =>
    h.includes('informacion adicional') || h.includes('anadir') || h.includes('add') || h.includes('datos') || h.includes('mejorar')
  );

  if (prodIdx === -1) return [];

  // Parse productos
  const productos: Producto[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = splitCSVLine(lines[i], delimiter);
    if (values[prodIdx]) {
      // Prefer "Nombre del problema" as the error type — it contains "Falta el valor [availability]" etc.
      // Fall back to "Información adicional" if problem column not present
      const queAgregar =
        problemIdx >= 0 && values[problemIdx]
          ? values[problemIdx]
          : addIdx >= 0 && values[addIdx]
          ? values[addIdx]
          : '';
      productos.push({
        nombre: values[prodIdx],
        descripcionActual: descIdx >= 0 ? values[descIdx] || '' : '',
        queAgregar,
      });
    }
  }

  return productos;
}
