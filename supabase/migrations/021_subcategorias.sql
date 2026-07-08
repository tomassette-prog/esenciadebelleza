-- ============================================================
-- MIGRACIÓN 021: Tabla de Subcategorías dinámicas con SEO
-- ============================================================

-- Crear tabla para gestionar subcategorías desde el admin
CREATE TABLE subcategorias (
  id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  categoria TEXT NOT NULL,          -- "peluqueria", "estetica", "barberia", "perfumeria"
  slug      TEXT NOT NULL,          -- "tintes", "champus", etc. (URL-friendly)
  label     TEXT NOT NULL,          -- "Tintes", "Champús" (nombre visible en navbar)
  columna   TEXT,                   -- Nombre de la columna/grupo (ej: "Coloración", "Cuidado Capilar")
  orden     INTEGER NOT NULL DEFAULT 0,   -- Orden de aparición
  
  -- SEO (meta tags)
  seo_title       TEXT CHECK (char_length(seo_title) <= 60),
  seo_description TEXT CHECK (char_length(seo_description) <= 155),
  
  -- Contenido introductorio (HTML)
  descripcion_intro TEXT,
  
  activa    BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Uniqueness por (categoria, slug)
  UNIQUE(categoria, slug)
);

-- Índices
CREATE INDEX idx_subcategorias_categoria ON subcategorias (categoria);
CREATE INDEX idx_subcategorias_activa ON subcategorias (activa);
CREATE INDEX idx_subcategorias_orden ON subcategorias (categoria, orden);
CREATE INDEX idx_subcategorias_slug ON subcategorias (slug);

-- Trigger para updated_at
CREATE TRIGGER subcategorias_updated_at
  BEFORE UPDATE ON subcategorias
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- Insertar las subcategorías hardcodeadas actuales (sin SEO, se rellenan después)
INSERT INTO subcategorias (categoria, slug, label, columna, orden, seo_title, seo_description, descripcion_intro) VALUES
-- PELUQUERÍA - Coloración
('peluqueria', 'tintes', 'Tintes', 'Coloración', 1, NULL, NULL, NULL),
('peluqueria', 'decoloracion', 'Decoloración', 'Coloración', 2, NULL, NULL, NULL),
('peluqueria', 'oxigenadas', 'Oxigenadas', 'Coloración', 3, NULL, NULL, NULL),
('peluqueria', 'sin-amoniaco', 'Sin amoniaco', 'Coloración', 4, NULL, NULL, NULL),
-- PELUQUERÍA - Cuidado Capilar
('peluqueria', 'champus', 'Champús', 'Cuidado Capilar', 5, NULL, NULL, NULL),
('peluqueria', 'mascarillas', 'Mascarillas', 'Cuidado Capilar', 6, NULL, NULL, NULL),
('peluqueria', 'acondicionadores', 'Acondicionadores', 'Cuidado Capilar', 7, NULL, NULL, NULL),
('peluqueria', 'ampollas-y-serums', 'Ampollas y Sérums', 'Cuidado Capilar', 8, NULL, NULL, NULL),
('peluqueria', 'tratamientos', 'Tratamientos', 'Cuidado Capilar', 9, NULL, NULL, NULL),
-- PELUQUERÍA - Styling
('peluqueria', 'lacas', 'Lacas', 'Styling', 10, NULL, NULL, NULL),
('peluqueria', 'espumas', 'Espumas', 'Styling', 11, NULL, NULL, NULL),
('peluqueria', 'gominas-y-ceras', 'Gominas y Ceras', 'Styling', 12, NULL, NULL, NULL),
('peluqueria', 'rizos', 'Rizos y Anticrespo', 'Styling', 13, NULL, NULL, NULL),
('peluqueria', 'permanentes', 'Permanentes', 'Styling', 14, NULL, NULL, NULL),
-- PELUQUERÍA - Equipos y Herramientas
('peluqueria', 'secadores-y-planchas', 'Secadores y Planchas', 'Equipos y Herramientas', 15, NULL, NULL, NULL),
('peluqueria', 'maquinas-corte', 'Máquinas de corte', 'Equipos y Herramientas', 16, NULL, NULL, NULL),
('peluqueria', 'cepillos-y-peines', 'Cepillos y Peines', 'Equipos y Herramientas', 17, NULL, NULL, NULL),
('peluqueria', 'tijeras', 'Tijeras y Navajas', 'Equipos y Herramientas', 18, NULL, NULL, NULL),
('peluqueria', 'batas-y-capas', 'Batas y Capas', 'Equipos y Herramientas', 19, NULL, NULL, NULL),
('peluqueria', 'utensilios', 'Utensilios y Accesorios', 'Equipos y Herramientas', 20, NULL, NULL, NULL),
('peluqueria', 'mobiliario', 'Mobiliario', 'Equipos y Herramientas', 21, NULL, NULL, NULL),
-- ESTÉTICA - Facial
('estetica', 'cremas-faciales', 'Cremas faciales', 'Facial', 22, NULL, NULL, NULL),
('estetica', 'mascarillas-faciales', 'Mascarillas faciales', 'Facial', 23, NULL, NULL, NULL),
('estetica', 'serums-faciales', 'Sérums y Contorno de ojos', 'Facial', 24, NULL, NULL, NULL),
('estetica', 'gel-facial', 'Gel facial y limpieza', 'Facial', 25, NULL, NULL, NULL),
-- ESTÉTICA - Corporal
('estetica', 'cremas-corporales', 'Cremas corporales', 'Corporal', 26, NULL, NULL, NULL),
('estetica', 'aceites-corporales', 'Aceites corporales', 'Corporal', 27, NULL, NULL, NULL),
('estetica', 'leche-corporal', 'Leche corporal', 'Corporal', 28, NULL, NULL, NULL),
('estetica', 'gel-corporal', 'Gel de ducha', 'Corporal', 29, NULL, NULL, NULL),
('estetica', 'peeling', 'Peeling y Exfoliantes', 'Corporal', 30, NULL, NULL, NULL),
-- ESTÉTICA - Depilación
('estetica', 'ceras-depiladoras', 'Ceras depiladoras', 'Depilación', 31, NULL, NULL, NULL),
('estetica', 'depilatorios', 'Depilatorios', 'Depilación', 32, NULL, NULL, NULL),
-- ESTÉTICA - Uñas y Maquillaje
('estetica', 'manicura-pedicura', 'Manicura y Pedicura', 'Uñas y Maquillaje', 33, NULL, NULL, NULL),
('estetica', 'unas', 'Limas y Fresas', 'Uñas y Maquillaje', 34, NULL, NULL, NULL),
('estetica', 'lamparas-uv', 'Lámparas UV/LED', 'Uñas y Maquillaje', 35, NULL, NULL, NULL),
('estetica', 'maquillaje', 'Maquillaje', 'Uñas y Maquillaje', 36, NULL, NULL, NULL),
-- BARBERÍA - Afeitado y Barba
('barberia', 'ceras-barbero', 'Ceras de barbero', 'Afeitado y Barba', 37, NULL, NULL, NULL),
('barberia', 'champus-barba', 'Champús de barba', 'Afeitado y Barba', 38, NULL, NULL, NULL),
-- BARBERÍA - Styling y cuidado caballero
('barberia', 'cuidado-caballero', 'Cuidado caballero', 'Styling y cuidado caballero', 39, NULL, NULL, NULL),
-- PERFUMERÍA - Perfumes
('perfumeria', 'eau-de-parfum', 'Eau de Parfum', 'Perfumes', 40, NULL, NULL, NULL),
('perfumeria', 'eau-de-toilette', 'Eau de Toilette', 'Perfumes', 41, NULL, NULL, NULL),
('perfumeria', 'colonias', 'Colonias', 'Perfumes', 42, NULL, NULL, NULL),
-- PERFUMERÍA - Ambientación
('perfumeria', 'ambientadores', 'Ambientadores', 'Ambientación', 43, NULL, NULL, NULL),
('perfumeria', 'brumas-y-velas', 'Brumas y Velas', 'Ambientación', 44, NULL, NULL, NULL);
