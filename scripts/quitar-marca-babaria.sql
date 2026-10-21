-- ============================================
-- Quitar de la web los productos de la marca Babaria
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- Orden: primero supabase/migrations/034_bloquear_marcas_ocultas.sql
-- (blindaje), después este script (ocultación).
-- ============================================
-- Ocultación reversible: los productos NO se borran, solo dejan de
-- mostrarse (productos_padre.activo = false) y de venderse
-- (productos_variaciones.activa = false).
-- ============================================

-- 1. Ver las marcas que encajan
SELECT id, nombre, slug, activa
FROM marcas
WHERE LOWER(TRIM(nombre)) LIKE '%babaria%';

-- 2. Ver los productos que se van a ocultar
SELECT p.id, p.nombre, p.slug, p.activo, m.nombre AS marca
FROM productos_padre p
JOIN marcas m ON m.id = p.marca_id
WHERE LOWER(TRIM(m.nombre)) LIKE '%babaria%'
ORDER BY p.nombre;

-- 3. Productos sin marca asignada pero con "babaria" en nombre/slug
--    (revisar a mano: pueden ser Babaria con el atributo de marca perdido)
SELECT id, nombre, slug, activo, marca_id
FROM productos_padre
WHERE (LOWER(nombre) LIKE '%babaria%' OR LOWER(slug) LIKE '%babaria%')
  AND (marca_id IS NULL
       OR marca_id NOT IN (SELECT id FROM marcas WHERE LOWER(TRIM(nombre)) LIKE '%babaria%'))
ORDER BY nombre;

-- 4. Ocultar marca, productos y variaciones
UPDATE marcas
SET activa = false
WHERE LOWER(TRIM(nombre)) LIKE '%babaria%';

UPDATE productos_padre
SET activo = false
WHERE marca_id IN (
  SELECT id FROM marcas WHERE LOWER(TRIM(nombre)) LIKE '%babaria%'
);

UPDATE productos_variaciones
SET activa = false
WHERE producto_padre_id IN (
  SELECT p.id
  FROM productos_padre p
  JOIN marcas m ON m.id = p.marca_id
  WHERE LOWER(TRIM(m.nombre)) LIKE '%babaria%'
);

-- 5. Verificación: debe devolver 0 filas
SELECT p.id, p.nombre
FROM productos_padre p
JOIN marcas m ON m.id = p.marca_id
WHERE LOWER(TRIM(m.nombre)) LIKE '%babaria%'
  AND p.activo = true;

-- 5b. Y ninguna variación vendible
SELECT v.id, v.sku
FROM productos_variaciones v
JOIN productos_padre p ON p.id = v.producto_padre_id
JOIN marcas m ON m.id = p.marca_id
WHERE LOWER(TRIM(m.nombre)) LIKE '%babaria%'
  AND v.activa = true;

-- ============================================
-- ROLLBACK (solo para volver a publicar la marca)
-- Ojo: reactiva también los productos que estuvieran inactivos
-- antes de este script; revisar el paso 2 guardado antes de ejecutar.
-- ============================================
-- UPDATE marcas
-- SET activa = true
-- WHERE LOWER(TRIM(nombre)) LIKE '%babaria%';
--
-- UPDATE productos_padre
-- SET activo = true
-- WHERE marca_id IN (
--   SELECT id FROM marcas WHERE LOWER(TRIM(nombre)) LIKE '%babaria%'
-- );
--
-- UPDATE productos_variaciones
-- SET activa = true
-- WHERE producto_padre_id IN (
--   SELECT p.id
--   FROM productos_padre p
--   JOIN marcas m ON m.id = p.marca_id
--   WHERE LOWER(TRIM(m.nombre)) LIKE '%babaria%'
-- );
