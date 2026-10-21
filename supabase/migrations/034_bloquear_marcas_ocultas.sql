-- ============================================================
-- MIGRACIÓN 034: Bloqueo de marcas ocultas
-- ============================================================
-- `marcas.activa = false` significa "marca retirada de la web".
-- Estos triggers fuerzan que sus productos queden invisibles y no
-- comprables, sin importar qué proceso escriba en las tablas:
-- cron de sync-precios, webhook de WooCommerce o importaciones
-- manuales reactivan `activo`/`activa` desde WooCommerce, y una
-- marca retirada no debe volver a publicarse por ese camino.
--
-- Ocultar una marca en caliente exige además desactivar sus
-- productos (los triggers solo actúan al escribir en esas tablas):
-- ver scripts/quitar-marca-babaria.sql.
-- ============================================================

CREATE OR REPLACE FUNCTION fn_marca_oculta_padre()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.marca_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM marcas m WHERE m.id = NEW.marca_id AND m.activa = false
  ) THEN
    NEW.activo := false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_marca_oculta_padre ON productos_padre;
CREATE TRIGGER trg_marca_oculta_padre
  BEFORE INSERT OR UPDATE ON productos_padre
  FOR EACH ROW EXECUTE FUNCTION fn_marca_oculta_padre();

CREATE OR REPLACE FUNCTION fn_marca_oculta_variacion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM productos_padre p
    JOIN marcas m ON m.id = p.marca_id
    WHERE p.id = NEW.producto_padre_id
      AND m.activa = false
  ) THEN
    NEW.activa := false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_marca_oculta_variacion ON productos_variaciones;
CREATE TRIGGER trg_marca_oculta_variacion
  BEFORE INSERT OR UPDATE ON productos_variaciones
  FOR EACH ROW EXECUTE FUNCTION fn_marca_oculta_variacion();
