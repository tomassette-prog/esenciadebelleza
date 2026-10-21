-- ============================================================
-- MIGRACIÓN 039: oculto_manual (copias redundantes retiradas)
-- ============================================================
-- Marca productos que el equipo retira a mano (por ejemplo copias
-- duplicadas del catálogo del proveedor). Un trigger fuerza
-- activo=false mientras la marca esté puesta, de modo que el sync
-- nocturno, el webhook o una importación completa no los vuelvan a
-- publicar. También desactiva sus variaciones para que no se puedan
-- vender desde carritos viejos.
-- ============================================================

ALTER TABLE productos_padre
  ADD COLUMN IF NOT EXISTS oculto_manual boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION fn_oculto_manual_padre()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.oculto_manual THEN
    NEW.activo := false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_oculto_manual_padre ON productos_padre;
CREATE TRIGGER trg_oculto_manual_padre
  BEFORE INSERT OR UPDATE ON productos_padre
  FOR EACH ROW EXECUTE FUNCTION fn_oculto_manual_padre();

CREATE OR REPLACE FUNCTION fn_oculto_manual_variacion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM productos_padre p
    WHERE p.id = NEW.producto_padre_id AND p.oculto_manual
  ) THEN
    NEW.activa := false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_oculto_manual_variacion ON productos_variaciones;
CREATE TRIGGER trg_oculto_manual_variacion
  BEFORE INSERT OR UPDATE ON productos_variaciones
  FOR EACH ROW EXECUTE FUNCTION fn_oculto_manual_variacion();
