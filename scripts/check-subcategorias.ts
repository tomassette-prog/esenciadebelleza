import { createAdminClient } from '../lib/supabase/admin';

async function checkSubcategorias() {
  console.log('Verificando tabla subcategorias...\n');
  
  const supa = createAdminClient();
  
  // Contar registros
  const { count, error: countError } = await supa
    .from('subcategorias')
    .select('*', { count: 'exact', head: true });
  
  if (countError) {
    console.error('❌ Error al contar:', countError.message);
    return;
  }
  
  console.log(`📊 Total de registros: ${count || 0}\n`);
  
  // Si hay registros, mostrar algunos
  if (count && count > 0) {
    const { data, error } = await supa
      .from('subcategorias')
      .select('*')
      .limit(5);
    
    if (error) {
      console.error('❌ Error al leer:', error.message);
    } else {
      console.log('📝 Primeros 5 registros:');
      console.table(data);
    }
  } else {
    console.log('⚠️  La tabla subcategorias está vacía!\n');
    console.log('Esto explica por qué la navbar solo muestra "Marcas" y "Blog"\n');
  }
}

checkSubcategorias().catch(console.error);
