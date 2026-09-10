-- Facturas para profesionales B2B
-- Bucket "facturas" en Supabase Storage (privado, solo acceso firmado)

CREATE TABLE IF NOT EXISTS facturas (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profesional_id UUID NOT NULL REFERENCES perfiles_usuario(id) ON DELETE CASCADE,
  nombre        TEXT NOT NULL,                       -- nombre descriptivo (ej: "Factura Enero 2026")
  archivo_path  TEXT NOT NULL,                       -- ruta en Storage (ej: profesionales/{uuid}/factura-ene-2026.pdf)
  archivo_size  INTEGER,                             -- tamaño en bytes
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_facturas_profesional ON facturas(profesional_id, created_at DESC);

-- RLS: el profesional solo ve sus facturas
ALTER TABLE facturas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profesional ve sus facturas"
  ON facturas FOR SELECT
  USING (auth.uid() = profesional_id);

-- Admin puede hacer todo (vía service_role, no necesita política)
