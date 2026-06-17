-- ============================================================
-- MIGRACIÓN 003: Multiplicador de precio y config global
-- Permite aplicar un margen % sobre precios de WooCommerce
-- sin modificar los precios base importados.
--
-- Uso actual:  multiplicador = 1.0  (mismo precio que WC)
-- Uso futuro:  multiplicador = 1.15 (15% más caro en Esencia)
-- ============================================================

-- Tabla de configuración global del sitio
CREATE TABLE IF NOT EXISTS config_tienda (
  clave   TEXT PRIMARY KEY,
  valor   TEXT NOT NULL,
  descripcion TEXT
);

-- Multiplicador global de precio (aplica a todos los productos)
INSERT INTO config_tienda (clave, valor, descripcion) VALUES
  ('precio_multiplicador_b2c', '1.0',  'Factor multiplicador sobre precio WooCommerce para B2C. Ej: 1.15 = +15%'),
  ('precio_multiplicador_b2b', '1.0',  'Factor multiplicador sobre precio WooCommerce para B2B. Ej: 0.90 = -10%'),
  ('envio_gratis_desde',       '49.0', 'Importe mínimo en EUR para envío gratuito'),
  ('envio_coste',              '4.95', 'Coste de envío estándar en EUR')
ON CONFLICT (clave) DO NOTHING;

-- Multiplicador por variación (sobreescribe el global si está definido)
ALTER TABLE productos_variaciones
  ADD COLUMN IF NOT EXISTS precio_multiplicador NUMERIC(6,4) DEFAULT NULL;

-- Vista calculada: precio_final = precio_b2c * multiplicador_variacion ?? multiplicador_global
COMMENT ON COLUMN productos_variaciones.precio_multiplicador IS
  'Si NULL usa config_tienda.precio_multiplicador_b2c. Si definido, sobreescribe el global para esta variación.';

-- Permisos
GRANT SELECT, INSERT, UPDATE ON config_tienda TO service_role;
GRANT SELECT ON config_tienda TO authenticated;
GRANT SELECT ON config_tienda TO anon;
