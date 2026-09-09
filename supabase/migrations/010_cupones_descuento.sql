-- ============================================================
-- MIGRACIÓN 010: SISTEMA DE CUPONES DE DESCUENTO
-- ============================================================

CREATE TABLE cupones (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  codigo          TEXT NOT NULL UNIQUE,
  descripcion     TEXT,

  -- Tipo de descuento: porcentaje (0-100) o importe fijo en euros
  tipo            TEXT NOT NULL DEFAULT 'porcentaje'
                  CHECK (tipo IN ('porcentaje', 'fijo')),
  valor           NUMERIC(10,2) NOT NULL CHECK (valor > 0),

  -- Restricciones de uso
  usos_maximos    INTEGER,            -- NULL = ilimitado
  usos_actuales   INTEGER NOT NULL DEFAULT 0,
  fecha_expiracion TIMESTAMPTZ,       -- NULL = sin caducidad
  importe_minimo  NUMERIC(10,2) DEFAULT 0, -- pedido mínimo para aplicar

  -- Estado
  activo          BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cupones_codigo ON cupones (codigo);
CREATE TRIGGER cupones_updated_at
  BEFORE UPDATE ON cupones
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Tabla de uso de cupones (historial)
CREATE TABLE cupones_uso (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cupon_id        UUID NOT NULL REFERENCES cupones(id) ON DELETE CASCADE,
  pedido_id       UUID NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  usuario_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  descuento_aplicado NUMERIC(10,2) NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cupones_uso_cupon  ON cupones_uso (cupon_id);
CREATE INDEX idx_cupones_uso_pedido ON cupones_uso (pedido_id);

-- Añadir referencia de cupón al pedido
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS cupon_id UUID REFERENCES cupones(id) ON DELETE SET NULL;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS descuento_cupon NUMERIC(10,2) DEFAULT 0;
