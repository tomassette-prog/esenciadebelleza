-- ============================================================
-- MIGRACIÓN 036: Búsqueda por nombre de marca sin tildes
-- ============================================================
-- Extiende nombre_norm a la tabla marcas para que la búsqueda
-- pública encuentre productos también por marca ("wella" debe
-- devolver todos los productos Wella, no solo los que llevan
-- "wella" en el nombre del producto).
-- Requiere la migración 035 (función f_unaccent).
-- ============================================================

ALTER TABLE marcas
  ADD COLUMN IF NOT EXISTS nombre_norm text
  GENERATED ALWAYS AS (lower(f_unaccent(nombre))) STORED;
