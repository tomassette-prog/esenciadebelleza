const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  // Contar variaciones por producto de todos los productos
  const r = await s.from('productos_variaciones')
    .select('producto_padre_id, nombre_variacion, activa, precio_b2c');

  const counts = {};
  (r.data || []).forEach(v => {
    if (!counts[v.producto_padre_id]) counts[v.producto_padre_id] = [];
    counts[v.producto_padre_id].push({ nombre: v.nombre_variacion, activa: v.activa, precio: v.precio_b2c });
  });

  const multi = Object.entries(counts).filter(([, arr]) => arr.length > 1);
  console.log(`Total productos con >1 variacion: ${multi.length}`);

  // Mostrar los 10 primeros con sus variaciones
  const ids = multi.slice(0, 10).map(([id]) => id);
  if (ids.length) {
    const p = await s.from('productos_padre').select('id, nombre').in('id', ids);
    p.data.forEach(prod => {
      const vars = counts[prod.id];
      console.log(`\n${prod.nombre}`);
      vars.forEach(v => console.log(`  - "${v.nombre}" activa=${v.activa} precio=${v.precio}`));
    });
  }

  // También buscar productos con variacion "Unidad" duplicada
  const duplicados = Object.entries(counts).filter(([, arr]) => {
    const unidad = arr.filter(v => v.nombre === 'Unidad');
    return unidad.length > 1;
  });
  console.log(`\nProductos con "Unidad" duplicado: ${duplicados.length}`);
}
main().catch(console.error);
