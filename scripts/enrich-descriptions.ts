import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Supabase connection - usando las credenciales publicadas
const SUPABASE_URL = 'https://yjanobsfzcwpusynvlun.supabase.co';
const SUPABASE_ADMIN_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_ADMIN_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY no configurada');
  console.error('📝 Por favor, exporta la variable de entorno: export SUPABASE_SERVICE_ROLE_KEY="tu_key"');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ADMIN_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

interface ProductoCSV {
  nombre: string;
  id: string;
  descActual: string;
  queAgregar: string;
}

// Mejora la descripción agregando formato y estructura
function mejorarDescripcion(nombre: string, descActual: string, queAgregar: string): string {
  // Si es muy corta, agregar más estructura
  if (!descActual || descActual.length < 100) {
    return `${nombre}: ${descActual || 'Producto de calidad profesional'}. ${queAgregar || 'Cuidado y protección del cabello.'}`;
  }

  // Si ya tiene buen contenido, hacer resumen más conciso
  let resumen = descActual;
  
  // Si incluye "MODO DE EMPLEO", truncar ahí
  const modoIdx = resumen.toUpperCase().indexOf('MODO DE EMPLEO');
  if (modoIdx > -1) {
    resumen = resumen.substring(0, modoIdx).trim();
  }

  // Agregar nota sobre qué Google sugiere
  if (queAgregar.includes('Fórmula')) {
    // Agregar ingredientes si no están ya presentes
    const ingredientes = extraerIngredientes(resumen);
    if (ingredientes.length > 0 && !resumen.toUpperCase().includes('INGREDIENTES')) {
      resumen += `. Ingredientes principales: ${ingredientes.slice(0, 3).join(', ')}.`;
    } else if (ingredientes.length === 0) {
      resumen += `. Contiene fórmula enriquecida con beneficios y componentes de calidad profesional.`;
    }
  }

  // Limitar a 500 caracteres
  if (resumen.length > 500) {
    resumen = resumen.substring(0, 497) + '...';
  }

  return resumen;
}

function extraerIngredientes(texto: string): string[] {
  const patrones = [
    'Keratina',
    'Proteínas',
    'Aceite de Argán',
    'Aceite de Jojoba',
    'Aceite de Macadamia',
    'Vitamina E',
    'Ácido Hialurónico',
    'Aloe Vera',
    'Extracto de Algas',
    'Células madre',
    'Ceramidas',
  ];

  const encontrados: string[] = [];
  for (const patron of patrones) {
    if (texto.toUpperCase().includes(patron.toUpperCase())) {
      encontrados.push(patron);
    }
  }
  return encontrados;
}

async function procesarCSV() {
  console.log('📋 Leyendo CSV...\n');
  
  const csvPath = path.join(__dirname, '../google-merchant-center.csv');
  const contenido = fs.readFileSync(csvPath, 'utf8');
  
  const lineas = contenido.split('\n');
  const headers = lineas[0].split(',').map(h => h.trim());
  
  // Encontrar índices de columnas
  const productoIdx = headers.findIndex(h => h.includes('Producto'));
  const idIdx = headers.findIndex(h => h.includes('ID de producto'));
  const descIdx = headers.findIndex(h => h.includes('Descripción'));
  const addIdx = headers.findIndex(h => h.includes('Añadir'));

  console.log(`📊 Columnas encontradas:`);
  console.log(`  • Producto (${productoIdx})`);
  console.log(`  • ID (${idIdx})`);
  console.log(`  • Descripción (${descIdx})`);
  console.log(`  • Añadir (${addIdx})\n`);

  const productos: ProductoCSV[] = [];
  
  for (let i = 1; i < lineas.length; i++) {
    if (!lineas[i].trim()) continue;
    
    // Parse CSV respetando comillas
    const valores: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let j = 0; j < lineas[i].length; j++) {
      const char = lineas[i][j];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        valores.push(current.trim().replace(/^"(.*)"$/, '$1'));
        current = '';
      } else {
        current += char;
      }
    }
    valores.push(current.trim().replace(/^"(.*)"$/, '$1'));

    if (valores[productoIdx]) {
      const nombre = valores[productoIdx].trim();
      const id = valores[idIdx]?.trim() || '';
      const descActual = valores[descIdx]?.trim() || '';
      const queAgregar = valores[addIdx]?.trim() || '';

      const descripcionMejorada = mejorarDescripcion(nombre, descActual, queAgregar);

      productos.push({
        nombre,
        id,
        descActual,
        queAgregar: queAgregar || 'Fórmula, Ingrediente, Beneficios',
      });
    }
  }

  console.log(`✅ ${productos.length} productos encontrados\n`);

  // Actualizar Supabase
  let exitosos = 0;
  let fallidos = 0;
  let notFound = 0;

  console.log('🔄 Procesando productos...\n');

  for (const prod of productos) {
    try {
      // Buscar por nombre exacto o similar
      const { data: encontrados, error } = await supabase
        .from('productos_padre')
        .select('id, nombre, slug, descripcion')
        .ilike('nombre', `%${prod.nombre}%`)
        .limit(1);

      if (error) throw error;

      if (encontrados && encontrados.length > 0) {
        const productoDB = encontrados[0];
        const desc = mejorarDescripcion(prod.nombre, prod.descActual, prod.queAgregar);
        
        // Actualizar
        const { error: updateError } = await supabase
          .from('productos_padre')
          .update({ descripcion: desc })
          .eq('id', productoDB.id);

        if (updateError) throw updateError;

        console.log(`✅ ${prod.nombre}`);
        console.log(`   ID: ${productoDB.id} | Slug: ${productoDB.slug}`);
        console.log(`   Nueva desc: ${desc.substring(0, 60)}...\n`);
        exitosos++;
      } else {
        console.log(`⚠️  ${prod.nombre} - NO ENCONTRADO\n`);
        notFound++;
      }
    } catch (err) {
      console.error(`❌ ${prod.nombre}: ${err instanceof Error ? err.message : String(err)}\n`);
      fallidos++;
    }

    // Rate limiting
    await new Promise(r => setTimeout(r, 300));
  }

  console.log(`\n📊 RESULTADOS`);
  console.log(`✅ Actualizados exitosamente: ${exitosos}`);
  console.log(`⚠️  No encontrados en Supabase: ${notFound}`);
  console.log(`❌ Errores: ${fallidos}`);
  console.log(`📈 Total procesado: ${exitosos + notFound + fallidos}/${productos.length}`);
}

procesarCSV().catch((err) => {
  console.error('❌ Error fatal:', err);
  process.exit(1);
});
