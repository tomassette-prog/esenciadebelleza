-- Añadir campos de redes sociales a la tabla posts
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS social_facebook  TEXT,
  ADD COLUMN IF NOT EXISTS social_instagram TEXT,
  ADD COLUMN IF NOT EXISTS social_tiktok    TEXT;
