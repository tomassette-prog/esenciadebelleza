-- ============================================================
-- MIGRACIÓN 040: bloquear marcas genéricas
-- ============================================================
-- El atributo "marca" de WooCommerce trae a veces palabras tipo de
-- producto (CREMA, SPRAY, GEL...) en lugar de la marca real. Este
-- trigger impide asignar esas marcas: mantiene la asignación previa
-- (o NULL en productos nuevos) para que la importación no vuelva a
-- ensuciar el catálogo ni el campo brand del feed de Google Merchant.
-- ============================================================

CREATE OR REPLACE FUNCTION fn_marca_no_generica()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  nombre_marca text;
BEGIN
  IF NEW.marca_id IS NOT NULL THEN
    SELECT lower(trim(nombre)) INTO nombre_marca FROM marcas WHERE id = NEW.marca_id;
    IF nombre_marca IN (
      'mascara', 'mascarilla', 'spray', 'gel', 'crema', 'champu', 'champú', 'tinte',
      'locion', 'balsamo', 'aceite', 'serum', 'cera', 'laca', 'maquillaje', 'perfume',
      'accesorio', 'accesorios', 'varios', 'otros', 'sin marca', 'kit', 'set'
    ) THEN
      IF TG_OP = 'INSERT' THEN
        NEW.marca_id := NULL;
      ELSE
        NEW.marca_id := OLD.marca_id;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_marca_no_generica ON productos_padre;
CREATE TRIGGER trg_marca_no_generica
  BEFORE INSERT OR UPDATE ON productos_padre
  FOR EACH ROW EXECUTE FUNCTION fn_marca_no_generica();
