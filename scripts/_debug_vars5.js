const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data: recientes } = await s.from('productos_padre')
    .select('id, nombre, slug, activo')
    .order('created_at', { ascending: false })
    .limit(100);

  const ids = recientes.map(p => p.id);
  const { data: vars } = await s.from('productos_variaciones')
    .select('producto_padre_id, nombre_variacion, activa, stock, precio_b2c')
    .in('producto_padre_id', ids);

  const varsByPadre = {};
  vars.forEach(v => {
    if (!varsByPadre[v.producto_padre_id]) varsByPadre[v.producto_padre_id] = [];
    varsByPadre[v.producto_padre_id].push(v);
  });

  const sinVars = recientes.filter(p => !(varsByPadre[p.id]?.length));
  console.log(`Recientes SIN variaciones: ${sinVars.length}`);
  sinVars.slice(0, 5).forEach(p => console.log(' -', p.nombre, '(activo:', p.activo + ')'));

  const conVarsInactivas = recientes.filter(p => {
    const v = varsByPadre[p.id] || [];
    return v.length > 0 && v.every(x => !x.activa);
  });
  console.log(`\nRecientes con TODAS variaciones inactivas: ${conVarsInactivas.length}`);
  conVarsInactivas.slice(0, 5).forEach(p => {
    const v = varsByPadre[p.id];
    console.log(' -', p.nombre, '→', v.map(x => `"${x.nombre_variacion}" stock=${x.stock} activa=${x.activa}`).join(', '));
  });

  console.log('\nPrimeros 5 recientes OK:');
  const ok = recientes.filter(p => (varsByPadre[p.id]||[]).some(v => v.activa)).slice(0,5);
  ok.forEach(p => {
    const v = varsByPadre[p.id].find(x => x.activa);
    console.log(' -', p.nombre, '→', `"${v.nombre_variacion}" precio=${v.precio_b2c} stock=${v.stock}`);
  });
}
main().catch(console.error);
