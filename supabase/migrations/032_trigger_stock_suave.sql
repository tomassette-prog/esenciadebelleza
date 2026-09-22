-- ============================================================
-- MIGRACIÓN 032: Trigger de stock suave (no bloquea ventas)
-- ============================================================
-- El trigger anterior lanzaba EXCEPTION si stock insuficiente,
-- lo que bloqueaba pedidos válidos cuando el stock no estaba
-- actualizado. Este nuevo comportamiento descuenta stock
-- sin importar si baja de 0, así nunca bloquea una venta.
-- ============================================================

CREATE OR REPLACE FUNCTION decrementar_stock()
RETURNS TRIGGER AS $$
BEGIN
  -- Descontar stock siempre, sin validar si hay suficiente
  -- Si el stock baja de 0, el admin lo ve en el panel y lo corrige
  UPDATE productos_variaciones
  SET stock = stock - NEW.cantidad
  WHERE id = NEW.variacion_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
