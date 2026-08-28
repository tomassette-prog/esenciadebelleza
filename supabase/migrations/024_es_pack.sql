-- Añadir columna es_pack a productos_padre (faltaba en el schema)
ALTER TABLE productos_padre
  ADD COLUMN IF NOT EXISTS es_pack BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_productos_padre_es_pack ON productos_padre(es_pack) WHERE es_pack = TRUE;
