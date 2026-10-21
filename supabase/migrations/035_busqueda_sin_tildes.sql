-- ============================================================
-- MIGRACIÓN 035: Búsqueda sin tildes (nombre_norm)
-- ============================================================
-- ILIKE distingue tildes: buscar "champu" no encuentra "Champú".
-- Se añade una columna generada con el nombre en minúsculas y sin
-- tildes; la búsqueda filtra sobre ella (y normaliza también lo que
-- teclea el usuario) para que con o sin tilde aparezcan todos los
-- resultados. La columna se recalcula sola al escribir en la tabla.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS unaccent;

-- unaccent es STABLE; el envoltorio IMMUTABLE permite usarlo en una
-- columna generada (diccionario fijo: práctica habitual)
CREATE OR REPLACE FUNCTION f_unaccent(text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$ SELECT unaccent('unaccent', $1) $$;

ALTER TABLE productos_padre
  ADD COLUMN IF NOT EXISTS nombre_norm text
  GENERATED ALWAYS AS (lower(f_unaccent(nombre))) STORED;
