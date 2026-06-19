-- ============================================================
-- MIGRACIÓN 004: TABLA BLOG POSTS
-- ============================================================

CREATE TABLE IF NOT EXISTS posts (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug              TEXT NOT NULL UNIQUE,
  titulo            TEXT NOT NULL,
  resumen           TEXT,
  contenido_html    TEXT NOT NULL,
  seo_title         TEXT CHECK (char_length(seo_title) <= 60),
  seo_description   TEXT CHECK (char_length(seo_description) <= 160),
  imagen_url        TEXT,
  publicado         BOOLEAN NOT NULL DEFAULT false,
  destacado         BOOLEAN NOT NULL DEFAULT false,
  autor             TEXT DEFAULT 'Esencia de Belleza',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_posts_slug       ON posts (slug);
CREATE INDEX IF NOT EXISTS idx_posts_publicado  ON posts (publicado);
CREATE INDEX IF NOT EXISTS idx_posts_published_at ON posts (published_at DESC);

-- Trigger updated_at
CREATE TRIGGER set_posts_updated_at
  BEFORE UPDATE ON posts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS: lectura pública solo para posts publicados
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "posts_public_read" ON posts
  FOR SELECT USING (publicado = true);

CREATE POLICY "posts_admin_all" ON posts
  FOR ALL USING (true)
  WITH CHECK (true);
