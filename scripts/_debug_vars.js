const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const r = await s.from('productos_variaciones')
    .select('producto_padre_id, nombre_variacion, activa')
    .order('created_at', { ascending: false })
    .limit(500);

  const counts = {};
  (r.data || []).forEach(v => {
    if (!counts[v.producto_padre_id]) counts[v.producto_padre_id] = [];
    counts[v.producto_padre_id].push(v.nombre_variacion);
  });

  const multi = Object.entries(counts).filter(([, arr]) => arr.length > 1).slice(0, 5);
  console.log('Productos recientes con >1 variacion:', multi.length);

  if (multi.length) {
    const ids = multi.map(([id]) => id);
    const p = await s.from('productos_padre').select('id, nombre').in('id', ids);
    const vars = await s.from('productos_variaciones')
      .select('nombre_variacion, activa, stock, precio_b2c')
      .in('producto_padre_id', ids);
    
    p.data.forEach(prod => {
      const v = vars.data.filter(x => x.producto_padre_id === prod.id);
      console.log('\n' + prod.nombre);
      console.log('  Variaciones:', counts[prod.id]);
    });
  } else {
    console.log('Todos los productos recientes tienen solo 1 variacion.');
    console.log('Revisando variaciones inactivas...');
    
    const inactive = (r.data || []).filter(v => v.activa === false).slice(0, 5);
    console.log('Variaciones inactivas recientes:', inactive.length, inactive.map(v => v.nombre_variacion));
  }
}
main().catch(console.error);
