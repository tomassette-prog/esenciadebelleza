-- 035: cupones_uso — one order can consume a coupon use only once
--
-- Why: registrarUsoCupon could double-count on retries/races (webhook + page
-- confirmation), making usos_maximos drift. The DB now enforces uniqueness per
-- order so the counter cannot be inflated no matter how many times it is called.
--
-- Apply in the Supabase SQL Editor. Idempotent.

DELETE FROM cupones_uso a USING cupones_uso b
WHERE a.pedido_id = b.pedido_id AND a.ctid > b.ctid;

CREATE UNIQUE INDEX IF NOT EXISTS idx_cupones_uso_pedido ON cupones_uso (pedido_id);
