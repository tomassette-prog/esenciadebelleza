-- ============================================================
-- MIGRACIÓN 020: Agregar woo_id para deduplicación por WooCommerce
-- ============================================================

-- Agregar columna woo_id para identificación única con WooCommerce
ALTER TABLE productos_padre
ADD COLUMN woo_id INTEGER UNIQUE;

-- Índice para búsquedas rápidas por woo_id
CREATE INDEX idx_productos_padre_woo_id ON productos_padre (woo_id);
