'use client';

import { useState } from 'react';
import { enriquecerProducto } from '@/actions/merchant-center';

interface Producto {
  nombre: string;
  descripcionActual: string;
  queAgregar: string;
  descripcionGenerada?: string;
  error?: string;
}

export default function MerchantCenterUploadSimple() {
  const [csvText, setCsvText] = useState('');
  const [productos, setProductos] = useState<Producto[]>([]);
  const [generando, setGenerando] = useState<Set<number>>(new Set());

  const handleParsear = () => {
    if (!csvText.trim()) {
      alert('Pega el CSV primero');
      return;
    }

    const prods = parseCSV(csvText);
    if (prods.length === 0) {
      alert('No se encontraron productos. Verifica el formato.');
      return;
    }

    setProductos(prods);
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

  const conteoGeneradas = productos.filter(p => p.descripcionGenerada).length;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* PASO 1: Pegar CSV */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold mb-4">📋 Paso 1: Pega el CSV de Google</h2>
        
        <textarea
          value={csvText}
          onChange={e => setCsvText(e.target.value)}
          placeholder={`Ejemplo:
Producto,Descripción,Añadir a la descripción
Champú Hidratante,Champú base,Contiene proteínas
Acondicionador,Acondicionador,Para cabello seco`}
          className="w-full h-32 p-3 border rounded font-mono text-sm"
        />

        <button
          onClick={handleParsear}
          className="mt-4 px-6 py-2 bg-blue-600 text-white rounded font-semibold hover:bg-blue-700"
        >
          ✓ Parsear CSV
        </button>
        
        {productos.length > 0 && (
          <p className="mt-2 text-sm text-gray-600">
            ✅ {productos.length} productos encontrados
          </p>
        )}
      </div>

      {/* PASO 2: Generar descripciones */}
      {productos.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">✨ Paso 2: Genera descripciones</h2>

          <div className="space-y-3">
            {productos.map((prod, idx) => (
              <div key={idx} className="border rounded p-4 bg-gray-50">
                {/* Nombre */}
                <p className="font-semibold text-gray-800">{prod.nombre}</p>

                {/* Descripción actual + lo que falta */}
                <div className="text-sm text-gray-600 mt-2 grid grid-cols-2 gap-2">
                  <div>
                    <span className="font-medium">Actual:</span> {prod.descripcionActual || 'N/A'}
                  </div>
                  <div>
                    <span className="font-medium">Google dice:</span> {prod.queAgregar || 'N/A'}
                  </div>
                </div>

                {/* Descripción generada o error */}
                {prod.descripcionGenerada ? (
                  <div className="mt-3 p-3 bg-green-100 border border-green-300 rounded">
                    <p className="text-sm text-green-800 font-semibold">✅ Generada:</p>
                    <p className="text-sm text-green-700">{prod.descripcionGenerada}</p>
                  </div>
                ) : prod.error ? (
                  <div className="mt-3 p-3 bg-red-100 border border-red-300 rounded">
                    <p className="text-sm text-red-800 font-semibold">❌ {prod.error}</p>
                  </div>
                ) : null}

                {/* Botón generar */}
                {!prod.descripcionGenerada && (
                  <button
                    onClick={() => handleGenerar(idx)}
                    disabled={generando.has(idx)}
                    className="mt-3 px-4 py-2 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 disabled:bg-gray-400"
                  >
                    {generando.has(idx) ? '⏳ Generando...' : 'Generar descrición'}
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Resumen */}
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded">
            <p className="font-semibold">
              {conteoGeneradas} de {productos.length} descripciones generadas ✨
            </p>
          </div>
        </div>
      )}
    </div>
  );
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
  const headers = firstLine.split(delimiter).map(h => h.toLowerCase().trim());
  const prodIdx = headers.findIndex(h => 
    h.includes('producto') || h.includes('product') || h.includes('title') || h.includes('nombre')
  );
  const descIdx = headers.findIndex(h => 
    h.includes('descripción') || h.includes('description') || h.includes('descripcion')
  );
  const addIdx = headers.findIndex(h => 
    h.includes('añadir') || h.includes('add') || h.includes('datos') || h.includes('mejorar')
  );

  if (prodIdx === -1) return [];

  // Parse productos
  const productos: Producto[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(delimiter).map(v => v.trim());
    if (values[prodIdx]) {
      productos.push({
        nombre: values[prodIdx],
        descripcionActual: descIdx >= 0 ? values[descIdx] || '' : '',
        queAgregar: addIdx >= 0 ? values[addIdx] || '' : '',
      });
    }
  }

  return productos;
}
