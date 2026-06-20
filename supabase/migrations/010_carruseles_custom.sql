-- ============================================================
-- MIGRACIÓN 010: Carruseles personalizados de la home
-- ============================================================

CREATE TABLE IF NOT EXISTS carruseles (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre      TEXT NOT NULL,
  subtitulo   TEXT,
  activo      BOOLEAN NOT NULL DEFAULT true,
  orden       INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS carrusel_productos (
  carrusel_id UUID NOT NULL REFERENCES carruseles(id) ON DELETE CASCADE,
  producto_id UUID NOT NULL REFERENCES productos_padre(id) ON DELETE CASCADE,
  orden       INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (carrusel_id, producto_id)
);

CREATE INDEX IF NOT EXISTS idx_carrusel_productos_carrusel ON carrusel_productos(carrusel_id, orden);

-- RLS
ALTER TABLE carruseles ENABLE ROW LEVEL SECURITY;
ALTER TABLE carrusel_productos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "carruseles_public_read" ON carruseles FOR SELECT USING (true);
CREATE POLICY "carruseles_admin_all"   ON carruseles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "carrusel_productos_public_read" ON carrusel_productos FOR SELECT USING (true);
CREATE POLICY "carrusel_productos_admin_all"   ON carrusel_productos FOR ALL USING (true) WITH CHECK (true);

-- Grants
GRANT SELECT ON carruseles TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON carruseles TO service_role;
GRANT SELECT ON carrusel_productos TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON carrusel_productos TO service_role;

-- Insertar 2 carruseles de ejemplo
INSERT INTO carruseles (nombre, subtitulo, activo, orden)
VALUES
  ('Ofertas especiales', 'No te lo pierdas', true, 0),
  ('Novedades', 'Recién llegados', true, 1)
ON CONFLICT DO NOTHING;
