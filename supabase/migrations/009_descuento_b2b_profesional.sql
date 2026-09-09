-- Añadir porcentaje de descuento B2B por profesional
-- Permite que cada profesional tenga un descuento configurable (0-100%)
-- que se aplica sobre el precio_b2c de cada producto.

ALTER TABLE perfiles_usuario
  ADD COLUMN IF NOT EXISTS descuento_b2b INTEGER NOT NULL DEFAULT 0
  CHECK (descuento_b2b >= 0 AND descuento_b2b <= 100);

COMMENT ON COLUMN perfiles_usuario.descuento_b2b IS
  'Porcentaje de descuento para precios B2B (0-100). Se aplica sobre precio_b2c.';
