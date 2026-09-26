-- ============================================
-- Limpieza de marcas basura
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================

-- 1. Ver qué marcas se van a borrar
SELECT m.id, m.nombre, COUNT(p.id) as productos_afectados
FROM marcas m
LEFT JOIN productos_padre p ON p.marca_id = m.id
WHERE LOWER(TRIM(m.nombre)) IN (
  'activador', 'pack', 'oferta', 'nuevo', 'promo', 'lote', 'set', 'kit',
  'muestra', 'viaje', 'profesional', 'natural', 'premium', 'basico',
  'sin marca', 'varios', 'generico', 'otras'
)
GROUP BY m.id, m.nombre
ORDER BY m.nombre;

-- 2. Desasociar productos (descomentar para ejecutar)
-- UPDATE productos_padre
-- SET marca_id = NULL
-- WHERE marca_id IN (
--   SELECT id FROM marcas
--   WHERE LOWER(TRIM(nombre)) IN (
--     'activador', 'pack', 'oferta', 'nuevo', 'promo', 'lote', 'set', 'kit',
--     'muestra', 'viaje', 'profesional', 'natural', 'premium', 'basico',
--     'sin marca', 'varios', 'generico', 'otras'
--   )
-- );

-- 3. Eliminar las marcas basura (descomentar para ejecutar)
-- DELETE FROM marcas
-- WHERE LOWER(TRIM(nombre)) IN (
--   'activador', 'pack', 'oferta', 'nuevo', 'promo', 'lote', 'set', 'kit',
--   'muestra', 'viaje', 'profesional', 'natural', 'premium', 'basico',
--   'sin marca', 'varios', 'generico', 'otras'
-- );
