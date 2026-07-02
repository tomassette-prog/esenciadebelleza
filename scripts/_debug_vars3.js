const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  // Total variaciones
  const { count: totalVars } = await s.from('productos_variaciones').select('*', { count: 'exact', head: true });
  const { count: totalPadres } = await s.from('productos_padre').select('*', { count: 'exact', head: true });
  console.log(`Total productos: ${totalPadres}, Total variaciones: ${totalVars}`);
  console.log(`Media vars/producto: ${(totalVars / totalPadres).toFixed(2)}`);

  // Usar función SQL para contar productos con >1 variacion
  const { data, error } = await s.rpc('exec_sql', { 
    sql: `SELECT COUNT(DISTINCT producto_padre_id) as cnt FROM (
      SELECT producto_padre_id, COUNT(*) as n 
      FROM productos_variaciones 
      GROUP BY producto_padre_id 
      HAVING COUNT(*) > 1
    ) t`
  });
  if (error) {
    // Si no hay exec_sql, buscar manualmente con paginación
    console.log('Buscando con paginacion...');
    let page = 0, pageSize = 1000;
    const counts = {};
    while (true) {
      const r = await s.from('productos_variaciones').select('producto_padre_id').range(page * pageSize, (page + 1) * pageSize - 1);
      if (!r.data?.length) break;
      r.data.forEach(v => { counts[v.producto_padre_id] = (counts[v.producto_padre_id]||0)+1; });
      if (r.data.length < pageSize) break;
      page++;
      console.log(`  Pagina ${page}, acumulado: ${Object.keys(counts).length} productos unicos`);
    }
    const multi = Object.entries(counts).filter(([,c])=>c>1);
    console.log(`Productos con >1 variacion: ${multi.length}`);
    if (multi.length) {
      const ids = multi.slice(0,5).map(([id])=>id);
      const p = await s.from('productos_padre').select('nombre').in('id',ids);
      const v = await s.from('productos_variaciones').select('nombre_variacion,producto_padre_id').in('producto_padre_id',ids);
      p.data.forEach(prod => console.log(' -', prod.nombre));
    }
  } else {
    console.log('Resultado SQL:', data);
  }
}
main().catch(console.error);
