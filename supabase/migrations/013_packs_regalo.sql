-- ── Packs de regalo ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS packs_regalo (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            text NOT NULL UNIQUE,
  nombre          text NOT NULL,
  descripcion     text,
  imagen_url      text,
  precio_pack     numeric(10,2) NOT NULL,
  precio_original numeric(10,2),          -- suma precios individuales (para mostrar ahorro)
  activo          boolean NOT NULL DEFAULT true,
  destacado       boolean NOT NULL DEFAULT false,
  orden           integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ── Items que componen cada pack ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS packs_regalo_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id      uuid NOT NULL REFERENCES packs_regalo(id) ON DELETE CASCADE,
  variacion_id uuid NOT NULL REFERENCES productos_variaciones(id) ON DELETE CASCADE,
  cantidad     integer NOT NULL DEFAULT 1 CHECK (cantidad > 0)
);

-- Índices
CREATE INDEX IF NOT EXISTS packs_regalo_items_pack_id_idx ON packs_regalo_items(pack_id);
CREATE INDEX IF NOT EXISTS packs_regalo_activo_idx ON packs_regalo(activo, orden);

-- RLS: lectura pública, escritura solo service_role
ALTER TABLE packs_regalo       ENABLE ROW LEVEL SECURITY;
ALTER TABLE packs_regalo_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "packs_regalo_public_read"
  ON packs_regalo FOR SELECT USING (true);

CREATE POLICY "packs_regalo_items_public_read"
  ON packs_regalo_items FOR SELECT USING (true);

-- updated_at automático
CREATE OR REPLACE FUNCTION update_packs_regalo_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_packs_regalo_updated_at ON packs_regalo;
CREATE TRIGGER trg_packs_regalo_updated_at
  BEFORE UPDATE ON packs_regalo
  FOR EACH ROW EXECUTE FUNCTION update_packs_regalo_updated_at();
