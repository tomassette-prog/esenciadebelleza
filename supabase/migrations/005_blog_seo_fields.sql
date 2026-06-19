-- ============================================================
-- MIGRACIÓN 005: Blog — imagen_alt y keywords
-- ============================================================

ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS imagen_alt   TEXT,
  ADD COLUMN IF NOT EXISTS keywords     TEXT;  -- palabras clave separadas por coma (uso interno + <meta keywords>)
