-- Fix: Bizum checkout blocked + stock never restored on unpaid cancellations
-- (2026-09-24, production).
--
-- 1) pedidos_estado_check rejected 'pendiente_bizum', so crearPedidoBizum ALWAYS
--    failed with 23514 and Bizum orders could never be created, even though the
--    code and admin/customer UIs use that state everywhere.
-- 2) Stock was decremented by trg_decrementar_stock at order creation but NEVER
--    restored when an unpaid order was cancelled or expired (abandoned Stripe
--    checkouts leaked stock until products looked sold out).
--
-- Restore policy: exactly once per order, only on the transition
-- pendiente/pendiente_bizum -> cancelado (flag stock_devuelto guards retries
-- and reopen-then-cancel cycles). Paid orders keep their decrement; physical
-- returns are handled manually.

-- ── 1. Allow 'pendiente_bizum' ───────────────────────────────────────────────
ALTER TABLE pedidos DROP CONSTRAINT IF EXISTS pedidos_estado_check;
ALTER TABLE pedidos ADD CONSTRAINT pedidos_estado_check
  CHECK (estado IN ('pendiente','pendiente_bizum','pagado','preparando','enviado','entregado','cancelado','reembolsado'));

-- ── 2. Restore-on-cancel machinery ───────────────────────────────────────────
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS stock_devuelto BOOLEAN NOT NULL DEFAULT FALSE;

-- Ensure the decrement trigger exists (idempotent re-apply of 027) so restore
-- and decrement stay symmetric regardless of migration history.
CREATE OR REPLACE FUNCTION decrementar_stock()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE productos_variaciones
  SET stock = stock - NEW.cantidad
  WHERE id = NEW.variacion_id AND stock >= NEW.cantidad;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Stock insuficiente para variación %', NEW.variacion_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_decrementar_stock ON pedidos_lineas;
CREATE TRIGGER trg_decrementar_stock
  AFTER INSERT ON pedidos_lineas
  FOR EACH ROW
  WHEN (NEW.variacion_id IS NOT NULL)
  EXECUTE FUNCTION decrementar_stock();

CREATE OR REPLACE FUNCTION restaurar_stock_al_cancelar()
RETURNS TRIGGER AS $$
DECLARE
  linea RECORD;
BEGIN
  IF NEW.estado = 'cancelado'
     AND OLD.estado IN ('pendiente', 'pendiente_bizum')
     AND NOT NEW.stock_devuelto THEN
    NEW.stock_devuelto := TRUE;
    FOR linea IN
      SELECT variacion_id, cantidad
      FROM pedidos_lineas
      WHERE pedido_id = NEW.id AND variacion_id IS NOT NULL
    LOOP
      UPDATE productos_variaciones
      SET stock = stock + linea.cantidad
      WHERE id = linea.variacion_id;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_restaurar_stock_al_cancelar ON pedidos;
CREATE TRIGGER trg_restaurar_stock_al_cancelar
  BEFORE UPDATE ON pedidos
  FOR EACH ROW EXECUTE FUNCTION restaurar_stock_al_cancelar();
