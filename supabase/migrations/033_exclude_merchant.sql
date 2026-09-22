-- ============================================================
-- MIGRACIÓN 033: Flag exclude_merchant
-- ============================================================
-- Marca productos que NO deben aparecer en Google Merchant
-- Center. Se usa para excluir cosmética/perfumería que Google
-- rechaza por política (sin CPNP, ingredientes, etc.)
-- ============================================================

ALTER TABLE productos_padre 
  ADD COLUMN IF NOT EXISTS exclude_merchant BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_padres_exclude_merchant 
  ON productos_padre (exclude_merchant) 
  WHERE exclude_merchant = TRUE;
