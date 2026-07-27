-- ============================================================
-- MIGRACIÓN 023: Tabla de snapshot WooCommerce para comparación incremental
-- ============================================================

-- Guarda el último estado conocido de cada producto en WooCommerce
-- para comparar cambios (precio, stock) sin depender de slug o woo_id en productos_padre

CREATE TABLE IF NOT EXISTS woo_snapshot (
  woo_id        INTEGER PRIMARY KEY,
  slug          TEXT NOT NULL,
  nombre        TEXT NOT NULL,
  precio        NUMERIC(10,2) NOT NULL DEFAULT 0,
  stock         INTEGER,
  activo        BOOLEAN NOT NULL DEFAULT true,
  snapshot_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice por slug para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_woo_snapshot_slug ON woo_snapshot(slug);

COMMENT ON TABLE woo_snapshot IS 'Último snapshot de WooCommerce para comparación incremental de precios y productos nuevos';

-- Permisos para los roles de Supabase
GRANT ALL ON woo_snapshot TO service_role;
GRANT ALL ON woo_snapshot TO authenticated;
GRANT ALL ON woo_snapshot TO anon;

-- Tabla para tracking de progreso del backfill (persiste entre invocaciones de Vercel)
CREATE TABLE IF NOT EXISTS backfill_progress (
  id INTEGER PRIMARY KEY DEFAULT 1,
  payload TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON backfill_progress TO service_role;
GRANT ALL ON backfill_progress TO authenticated;
GRANT ALL ON backfill_progress TO anon;
