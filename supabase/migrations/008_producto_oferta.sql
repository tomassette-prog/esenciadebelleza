-- Campo oferta en productos_padre para gestionar ofertas desde admin
ALTER TABLE productos_padre
  ADD COLUMN IF NOT EXISTS oferta BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_productos_padre_oferta ON productos_padre(oferta) WHERE oferta = TRUE;
