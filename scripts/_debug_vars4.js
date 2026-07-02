const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  // Buscar los productos recientes (últimos importados) que tienen >1 variacion
  const { data: recientes } = await s.from('productos_padre')
    .select('id, nombre, slug')
    .order('created_at', { ascending: false })
    .limit(100);

  const ids = recientes.map(p => p.id);
  const { data: vars } = await s.from('productos_variaciones')
    .select('producto_padre_id, nombre_variacion, activa, stock, precio_b2c')
    .in('producto_padre_id', ids);

  const porProducto = {};
  vars.forEach(v => {
    if (!porProducto[v.producto_padre_id]) porProducto[v.producto_padre_id] = [];
    porProducto[v.producto_padre_id].push(v);
  });

  const multi = recientes.filter(p => (porProducto[p.id]||[]).length > 1);
  console.log(`Recientes con >1 variacion: ${multi.length} de ${recientes.length}`);
  
  multi.slice(0, 8).forEach(p => {
    const v = porProducto[p.id];
    console.log(`\n${p.nombre}`);
    v.forEach(x => console.log(`  - "${x.nombre_variacion}" activa=${x.activa} stock=${x.stock} precio=${x.precio_b2c}`));
  });
}
main().catch(console.error);
