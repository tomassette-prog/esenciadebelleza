-- ============================================================
-- MIGRACIÓN 027: TRIGGER para decrementar stock en pedidos
-- ============================================================
-- La función decrementar_stock() ya existe desde la migración 001
-- pero nunca se creó el trigger que la ejecuta. Este trigger
-- descuenta stock automáticamente al insertar una línea de pedido.
-- ============================================================

CREATE TRIGGER trg_decrementar_stock
  AFTER INSERT ON pedidos_lineas
  FOR EACH ROW
  WHEN (NEW.variacion_id IS NOT NULL)
  EXECUTE FUNCTION decrementar_stock();
