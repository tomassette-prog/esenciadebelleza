import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ProductoCSV {
  nombre: string;
  id: string;
  descActual: string;
  queAgregar: string;
}

// Mejora la descripción
function mejorarDescripcion(nombre: string, descActual: string, queAgregar: string): string {
  if (!descActual || descActual.length < 100) {
    return `${nombre}: ${descActual || 'Producto de calidad profesional'}. ${queAgregar || 'Cuidado y protección del cabello.'}`;
  }

  let resumen = descActual;
  
  const modoIdx = resumen.toUpperCase().indexOf('MODO DE EMPLEO');
  if (modoIdx > -1) {
    resumen = resumen.substring(0, modoIdx).trim();
  }

  if (queAgregar.includes('Fórmula')) {
    const ingredientes = extraerIngredientes(resumen);
    if (ingredientes.length > 0 && !resumen.toUpperCase().includes('INGREDIENTES')) {
      resumen += `. Ingredientes principales: ${ingredientes.slice(0, 3).join(', ')}.`;
    } else if (ingredientes.length === 0) {
      resumen += `. Contiene fórmula enriquecida con beneficios y componentes de calidad profesional.`;
    }
  }

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

// Escapar comillas para SQL
function escaparSQL(str: string): string {
  return str.replace(/'/g, "''");
}

async function generarSQL() {
  console.log('📋 Leyendo CSV...\n');
  
  const csvPath = path.join(__dirname, '../google-merchant-center.csv');
  const contenido = fs.readFileSync(csvPath, 'utf8');
  
  const lineas = contenido.split('\n');
  const headers = lineas[0].split(',').map(h => h.trim());
  
  const productoIdx = headers.findIndex(h => h.includes('Producto'));
  const idIdx = headers.findIndex(h => h.includes('ID de producto'));
  const descIdx = headers.findIndex(h => h.includes('Descripción'));
  const addIdx = headers.findIndex(h => h.includes('Añadir'));

  const productos: ProductoCSV[] = [];
  
  for (let i = 1; i < lineas.length; i++) {
    if (!lineas[i].trim()) continue;
    
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

      productos.push({
        nombre,
        id,
        descActual,
        queAgregar: queAgregar || 'Fórmula, Ingrediente, Beneficios',
      });
    }
  }

  console.log(`✅ ${productos.length} productos encontrados\n`);

  // Generar SQL
  const sqlStatements: string[] = [];
  
  sqlStatements.push('-- Actualización de descripciones desde Google Merchant Center');
  sqlStatements.push(`-- Generado: ${new Date().toISOString()}`);
  sqlStatements.push(`-- Total de productos: ${productos.length}`);
  sqlStatements.push('-- Nota: Este script busca por nombre similar (ILIKE)\n');
  sqlStatements.push('BEGIN TRANSACTION;\n');

  let contador = 0;

  for (const prod of productos) {
    const descripcionMejorada = mejorarDescripcion(prod.nombre, prod.descActual, prod.queAgregar);
    const descEscapada = escaparSQL(descripcionMejorada);
    const nombreEscapado = escaparSQL(prod.nombre);

    sqlStatements.push(`-- ${contador + 1}. ${prod.nombre}`);
    sqlStatements.push(`UPDATE productos_padre`);
    sqlStatements.push(`SET descripcion = '${descEscapada}'`);
    sqlStatements.push(`WHERE nombre ILIKE '%${nombreEscapado}%'`);
    sqlStatements.push(`  AND descripcion != '${descEscapada}';`);
    sqlStatements.push('');

    contador++;
  }

  sqlStatements.push('COMMIT;');
  sqlStatements.push(`\n-- Fin: ${contador} actualizaciones preparadas`);

  const sqlContent = sqlStatements.join('\n');
  
  // Guardar archivo
  const outputPath = path.join(__dirname, '../update-descriptions-merchant.sql');
  fs.writeFileSync(outputPath, sqlContent, 'utf8');

  console.log(`✅ Archivo SQL generado: ${outputPath}`);
  console.log(`\n📊 Resumen:`);
  console.log(`   • Total de updates: ${contador}`);
  console.log(`   • Todas las actualizaciones están en una transacción`);
  console.log(`   • Puedes ejecutarlo directamente en Supabase SQL Editor`);
  console.log(`\n📝 Próximos pasos:`);
  console.log(`   1. Abre Supabase Dashboard: https://app.supabase.com/project/yjanobsfzcwpusynvlun`);
  console.log(`   2. Ve a SQL Editor`);
  console.log(`   3. Copia y pega el contenido de ${outputPath}`);
  console.log(`   4. Ejecuta los queries`);

  // Mostrar primeros 50 líneas del SQL
  console.log(`\n📄 Preview del SQL (primeras líneas):\n`);
  const preview = sqlContent.split('\n').slice(0, 20).join('\n');
  console.log(preview);
  console.log('\n...\n');
}

generarSQL().catch((err) => {
  console.error('❌ Error:', err);
  process.exit(1);
});
