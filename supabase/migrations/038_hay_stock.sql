-- ============================================================
-- MIGRACIÓN 038: hay_stock (agotados al final en los listados)
-- ============================================================
-- Los listados públicos ordenan por hay_stock DESC para que los
-- productos sin unidades disponibles aparezcan al final. La columna
-- se mantiene con un trigger sobre productos_variaciones, así que
-- cualquier escritura (sync nocturno, webhook, importaciones) la
-- deja al día sin tocar esos procesos.
-- ============================================================

ALTER TABLE productos_padre
  ADD COLUMN IF NOT EXISTS hay_stock boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION fn_actualizar_hay_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pid uuid;
BEGIN
  pid := CASE WHEN TG_OP = 'DELETE' THEN OLD.producto_padre_id ELSE NEW.producto_padre_id END;
  UPDATE productos_padre
  SET hay_stock = EXISTS (
    SELECT 1 FROM productos_variaciones v
    WHERE v.producto_padre_id = pid AND v.activa = true AND v.stock > 0
  )
  WHERE id = pid;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_actualizar_hay_stock ON productos_variaciones;
CREATE TRIGGER trg_actualizar_hay_stock
  AFTER INSERT OR UPDATE OR DELETE ON productos_variaciones
  FOR EACH ROW EXECUTE FUNCTION fn_actualizar_hay_stock();

-- Backfill inicial
UPDATE productos_padre p
SET hay_stock = EXISTS (
  SELECT 1 FROM productos_variaciones v
  WHERE v.producto_padre_id = p.id AND v.activa = true AND v.stock > 0
);
