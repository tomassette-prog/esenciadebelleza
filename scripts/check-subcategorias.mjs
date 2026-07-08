// Simple fetch request to check subcategorias
const SUPABASE_URL = 'https://yjanobsfzcwpusynvlun.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY no configurada');
  process.exit(1);
}

async function checkSubcategorias() {
  console.log('Verificando tabla subcategorias...\n');
  
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/subcategorias?limit=5`,
      {
        headers: {
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'apikey': SUPABASE_KEY,
        },
      }
    );

    if (!response.ok) {
      console.error(`❌ Error: ${response.status} ${response.statusText}`);
      const text = await response.text();
      console.error(text);
      return;
    }

    const data = await response.json();
    
    console.log(`📊 Registros obtenidos: ${Array.isArray(data) ? data.length : 0}\n`);
    
    if (Array.isArray(data) && data.length > 0) {
      console.log('📝 Primeros registros:');
      console.table(data);
    } else {
      console.log('⚠️  La tabla subcategorias está vacía!\n');
      console.log('Esto explica por qué la navbar solo muestra "Marcas" y "Blog"');
    }

  } catch (err) {
    console.error('❌ Error:', err);
  }
}

checkSubcategorias();
