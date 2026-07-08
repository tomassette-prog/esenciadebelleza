// Script para procesar CSV de Google Merchant Center y actualizar Supabase
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Cargar .env.local
dotenv.config({ path: path.join(__dirname, '../.env.local') });

// Supabase config - ID del proyecto desde instrucciones
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://yjanobsfzcwpusynvlun.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_KEY) {
  console.error('❌ Falta SUPABASE_SERVICE_ROLE_KEY en variables de entorno');
  console.error('📝 Configúralo en .env.local o en las variables de Vercel');
  process.exit(1);
}

console.log(`🔗 Conectando a Supabase: ${SUPABASE_URL}`);
if (!SUPABASE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY no disponible');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Mejora la descripción agregando formato y estructura
function mejorarDescripcion(nombre, descActual, queAgregar) {
  // Si es muy corta, agregar más estructura
  if (!descActual || descActual.length < 100) {
    return `${nombre}: ${descActual || 'Producto de calidad profesional'}. ${queAgregar || 'Beneficios: Cuidado y protección del cabello.'}`;
  }

  // Si ya tiene buen contenido, hacer resumen más conciso
  let resumen = descActual;
  
  // Si incluye "MODO DE EMPLEO", truncar ahí
  const modoIdx = resumen.toUpperCase().indexOf('MODO DE EMPLEO');
  if (modoIdx > -1) {
    resumen = resumen.substring(0, modoIdx).trim();
  }

  // Agregar información de Google si es necesario
  if (queAgregar && queAgregar.includes('Fórmula')) {
    // Buscar ingredientes en la descripción
    const ingredientes = extraerIngredientes(resumen);
    if (ingredientes.length > 0 && !resumen.includes('Ingredientes')) {
      resumen += `. Ingredientes principales: ${ingredientes.slice(0, 3).join(', ')}.`;
    }
  }

  // Limitar a 500 caracteres
  if (resumen.length > 500) {
    resumen = resumen.substring(0, 497) + '...';
  }

  return resumen;
}

function extraerIngredientes(texto) {
  const patrones = [
    /Keratina/gi,
    /Proteínas/gi,
    /Aceite de Argán/gi,
    /Aceite de Jojoba/gi,
    /Aceite de Macadamia/gi,
    /Vitamina E/gi,
    /Ácido Hialurónico/gi,
    /Aloe Vera/gi,
    /Extracto de Algas/gi,
    /Células madre/gi,
    /Ceramidas/gi,
  ];

  const encontrados = [];
  for (const patron of patrones) {
    if (patron.test(texto)) {
      encontrados.push(patron.source.replace(/\\/g, ''));
    }
  }
  return encontrados;
}

async function procesarCSV() {
  console.log('📋 Leyendo CSV...');
  
  const csvPath = path.join(__dirname, 'google-merchant-center.csv');
  const contenido = fs.readFileSync(csvPath, 'utf8');
  
  const lineas = contenido.split('\n');
  const headers = lineas[0].split(',').map(h => h.trim());
  
  // Encontrar índices de columnas
  const productoIdx = headers.findIndex(h => h.includes('Producto'));
  const idIdx = headers.findIndex(h => h.includes('ID de producto'));
  const descIdx = headers.findIndex(h => h.includes('Descripción'));
  const addIdx = headers.findIndex(h => h.includes('Añadir'));

  console.log(`📊 Columnas encontradas: Producto(${productoIdx}), ID(${idIdx}), Desc(${descIdx}), Añadir(${addIdx})`);

  const productos = [];
  
  for (let i = 1; i < lineas.length; i++) {
    if (!lineas[i].trim()) continue;
    
    const valores = lineas[i].split(',').map((v, idx) => {
      // Para la descripción, manejar comillas
      if (idx === descIdx) {
        return v.trim().replace(/^"(.*)"$/, '$1');
      }
      return v.trim();
    });

    if (valores[productoIdx]) {
      const nombre = valores[productoIdx].trim();
      const id = valores[idIdx]?.trim();
      const descActual = valores[descIdx]?.trim() || '';
      const queAgregar = valores[addIdx]?.trim() || '';

      const descripcionMejorada = mejorarDescripcion(nombre, descActual, queAgregar);

      productos.push({
        nombre,
        id,
        descActual,
        queAgregar,
        descripcionMejorada,
      });
    }
  }

  console.log(`✅ ${productos.length} productos encontrados\n`);

  // Actualizar Supabase
  let exitosos = 0;
  let fallidos = 0;

  for (const prod of productos) {
    try {
      // Buscar por nombre exacto
      const { data: encontrados, error } = await supabase
        .from('productos_padre')
        .select('id, nombre, slug')
        .ilike('nombre', `%${prod.nombre}%`)
        .limit(1);

      if (error) throw error;

      if (encontrados && encontrados.length > 0) {
        const productoDB = encontrados[0];
        
        // Actualizar
        const { error: updateError } = await supabase
          .from('productos_padre')
          .update({ descripcion: prod.descripcionMejorada })
          .eq('id', productoDB.id);

        if (updateError) throw updateError;

        console.log(`✅ ${prod.nombre}`);
        console.log(`   ID Supabase: ${productoDB.id}`);
        console.log(`   Nueva desc: ${prod.descripcionMejorada.substring(0, 60)}...\n`);
        exitosos++;
      } else {
        console.log(`⚠️  ${prod.nombre} - NO ENCONTRADO en Supabase\n`);
        fallidos++;
      }
    } catch (err) {
      console.error(`❌ ${prod.nombre}: ${err.message}\n`);
      fallidos++;
    }

    // Rate limiting
    await new Promise(r => setTimeout(r, 300));
  }

  console.log(`\n📊 RESULTADOS`);
  console.log(`✅ Exitosos: ${exitosos}`);
  console.log(`❌ Fallidos: ${fallidos}`);
  console.log(`📈 Total: ${exitosos + fallidos}`);
}

procesarCSV().catch(console.error);
