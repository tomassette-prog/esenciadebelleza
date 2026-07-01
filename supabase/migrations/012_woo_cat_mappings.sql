-- Migration 012: WooCommerce category mappings table
-- Stores the mapping from WooCommerce category IDs to our canonical categoria/subcategoria
-- This replaces the hardcoded WOO_CAT_MAP in lib/categorias.ts

CREATE TABLE IF NOT EXISTS woo_cat_mappings (
  woo_cat_id    INTEGER PRIMARY KEY,
  woo_cat_name  TEXT,
  categoria     TEXT NOT NULL,
  subcategoria  TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- RLS: public read, service_role write
ALTER TABLE woo_cat_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "woo_cat_mappings_public_read" ON woo_cat_mappings
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "woo_cat_mappings_service_write" ON woo_cat_mappings
  FOR ALL TO service_role USING (true);

-- Seed from existing hardcoded WOO_CAT_MAP
INSERT INTO woo_cat_mappings (woo_cat_id, woo_cat_name, categoria, subcategoria) VALUES
  -- PERFUMERÍA
  (1018, 'PERFUMES', 'perfumeria', 'eau-de-parfum'),
  (1019, 'Perfumes LATTAFA', 'perfumeria', 'eau-de-parfum'),
  (1027, 'DON ALGODON', 'perfumeria', 'eau-de-parfum'),
  (1030, 'AMBAR', 'perfumeria', 'eau-de-parfum'),
  (1031, 'AL HARAMAIN', 'perfumeria', 'eau-de-parfum'),
  (1032, 'ARMAF', 'perfumeria', 'eau-de-parfum'),
  (1033, 'MAISON ALHAMBRA', 'perfumeria', 'eau-de-parfum'),
  (1034, 'RAVE', 'perfumeria', 'eau-de-parfum'),
  (1035, 'RIIFFS', 'perfumeria', 'eau-de-parfum'),
  (1036, 'NUSUK', 'perfumeria', 'ambientadores'),
  (1037, 'THURAYA', 'perfumeria', 'eau-de-parfum'),
  (1038, 'ADYAN', 'perfumeria', 'eau-de-parfum'),
  (1039, 'MELINA', 'perfumeria', 'eau-de-parfum'),
  (1040, 'FRENCH AVENUE', 'perfumeria', 'eau-de-parfum'),
  (1041, 'AFNAN', 'perfumeria', 'eau-de-parfum'),
  (1042, 'PARIS CORNER', 'perfumeria', 'eau-de-parfum'),
  (1010, 'AMBIENTADORES', 'perfumeria', 'ambientadores'),
  (1011, 'Ambientador NUSUK', 'perfumeria', 'ambientadores'),
  (576,  'Bruma aromática', 'perfumeria', 'brumas-y-velas'),
  -- PELUQUERÍA · Coloración
  (99,  'Tintes', 'peluqueria', 'tintes'),
  (549, 'Sin amoniaco', 'peluqueria', 'sin-amoniaco'),
  (102, 'Decoloracion', 'peluqueria', 'decoloracion'),
  (104, 'Oxigenadas', 'peluqueria', 'oxigenadas'),
  (366, 'Cabellos Rubios', 'peluqueria', 'tintes'),
  (413, 'Fibras Capilares y Gel Colorante', 'peluqueria', 'tintes'),
  (533, 'Mascarilla Nutritiva Color MASK PLATINUM', 'peluqueria', 'tintes'),
  (959, 'Mascarilla Color FANOLA', 'peluqueria', 'tintes'),
  (277, 'Mascarilla Color GLOSSCO', 'peluqueria', 'tintes'),
  (561, 'Mascarilla COLOR MASK YUNSEY', 'peluqueria', 'tintes'),
  (411, 'Champu y Mascarilla Color VALQUER', 'peluqueria', 'tintes'),
  -- PELUQUERÍA · Cuidado Capilar
  (96,  'Champus', 'peluqueria', 'champus'),
  (97,  'Mascarillas', 'peluqueria', 'mascarillas'),
  (92,  'Acondicionadores', 'peluqueria', 'acondicionadores'),
  (61,  'Ampollas', 'peluqueria', 'ampollas-y-serums'),
  (265, 'Ampollas Capilares', 'peluqueria', 'ampollas-y-serums'),
  (95,  'Serum y Brillos', 'peluqueria', 'ampollas-y-serums'),
  (93,  'Tratamientos', 'peluqueria', 'tratamientos'),
  (100, 'Protectores Capilares', 'peluqueria', 'tratamientos'),
  (203, 'Aceite Capilar', 'peluqueria', 'tratamientos'),
  -- PELUQUERÍA · Styling
  (101, 'Lacas', 'peluqueria', 'lacas'),
  (94,  'Espumas de fijacion', 'peluqueria', 'espumas'),
  (105, 'Fijadores y Gominas', 'peluqueria', 'gominas-y-ceras'),
  (143, 'Gel', 'peluqueria', 'gominas-y-ceras'),
  (364, 'Definición Rizos', 'peluqueria', 'rizos'),
  (573, 'MÉTODO CURLY GIRL', 'peluqueria', 'rizos'),
  (194, 'Antiencrespado y Desenredante', 'peluqueria', 'rizos'),
  (98,  'Desrizantes', 'peluqueria', 'rizos'),
  (106, 'Permanentes', 'peluqueria', 'permanentes'),
  (103, 'Neutralizantes', 'peluqueria', 'permanentes'),
  (109, 'Plis', 'peluqueria', 'permanentes'),
  -- PELUQUERÍA · Equipos
  (121, 'Secadores', 'peluqueria', 'secadores-y-planchas'),
  (120, 'Planchas', 'peluqueria', 'secadores-y-planchas'),
  (107, 'Alisadores para el pelo', 'peluqueria', 'secadores-y-planchas'),
  (566, 'Cepillo Alisador', 'peluqueria', 'secadores-y-planchas'),
  (124, 'Difusores', 'peluqueria', 'secadores-y-planchas'),
  (123, 'Maquinas Cortapelo', 'peluqueria', 'maquinas-corte'),
  (239, 'Maquina Cortapelos Accesorios', 'peluqueria', 'maquinas-corte'),
  (156, 'Cepillos y Peines', 'peluqueria', 'cepillos-y-peines'),
  (79,  'Alicates y Tijeras', 'peluqueria', 'tijeras'),
  (157, 'Batas y Trajes de Peluqueria', 'peluqueria', 'batas-y-capas'),
  (158, 'Peinadores', 'peluqueria', 'batas-y-capas'),
  (159, 'Rulos', 'peluqueria', 'utensilios'),
  (160, 'Clips y Horquillas', 'peluqueria', 'utensilios'),
  (161, 'Redecillas', 'peluqueria', 'utensilios'),
  (207, 'Grapas y Pinzas', 'peluqueria', 'utensilios'),
  (209, 'Gorros', 'peluqueria', 'utensilios'),
  (216, 'Pulverizadores', 'peluqueria', 'utensilios'),
  (224, 'Desechables de Peluqueria', 'peluqueria', 'utensilios'),
  (225, 'Navaja y Utensilios', 'peluqueria', 'utensilios'),
  (125, 'Mobiliario de Peluqueria', 'peluqueria', 'mobiliario'),
  (126, 'Lavacabezas', 'peluqueria', 'mobiliario'),
  (129, 'Portasecador', 'peluqueria', 'mobiliario'),
  (244, 'Lavacabezas Recambios', 'peluqueria', 'mobiliario'),
  (371, 'PACKS', 'peluqueria', 'peluqueria-general'),
  -- ESTÉTICA · Facial
  (545, 'Cremas Faciales', 'estetica', 'cremas-faciales'),
  (62,  'Mascarillas Faciales', 'estetica', 'mascarillas-faciales'),
  (994, 'Contorno de Ojos', 'estetica', 'serums-faciales'),
  (574, 'Gel Facial', 'estetica', 'gel-facial'),
  -- ESTÉTICA · Corporal
  (546, 'Cremas Corporales', 'estetica', 'cremas-corporales'),
  (544, 'Cremas de Manos', 'estetica', 'cremas-corporales'),
  (58,  'Aceites Corporales', 'estetica', 'aceites-corporales'),
  (56,  'Leche Corporal', 'estetica', 'leche-corporal'),
  (547, 'Peeling', 'estetica', 'peeling'),
  (59,  'Crema Bronceadora y Spray Solar', 'estetica', 'cremas-corporales'),
  (426, 'Gel de Ducha', 'estetica', 'gel-facial'),
  -- ESTÉTICA · Depilación
  (68,  'Depilatorios', 'estetica', 'depilatorios'),
  (72,  'Fundidores de cera', 'estetica', 'ceras-depiladoras'),
  -- ESTÉTICA · Uñas y Maquillaje
  (54,  'Manicura y Pedicura', 'estetica', 'manicura-pedicura'),
  (82,  'Limas', 'estetica', 'unas'),
  (81,  'Fresas', 'estetica', 'unas'),
  (73,  'Lamparas de Uñas', 'estetica', 'lamparas-uv'),
  (53,  'Maquillajes', 'estetica', 'maquillaje'),
  -- ESTÉTICA · General
  (57,  'Cremas', 'estetica', 'cremas-faciales'),
  (87,  'Belleza', 'estetica', 'cremas-faciales'),
  (50,  'Aparatos de Estetica', 'estetica', 'cremas-faciales'),
  (70,  'Aparatologia de Estetica', 'estetica', 'cremas-faciales'),
  (66,  'Corporales de Estetica', 'estetica', 'cremas-corporales'),
  -- ESTÉTICA · varios
  (63,  'Desechables de Estetica', 'estetica', 'manicura-pedicura'),
  (67,  'Esmaltes', 'estetica', 'manicura-pedicura'),
  (579, 'Esmaltes semipermanentes CLARESA', 'estetica', 'manicura-pedicura'),
  (69,  'Micropigmentacion', 'estetica', 'maquillaje'),
  (425, 'Labiales y Lápiz Labial', 'estetica', 'maquillaje'),
  (974, 'Mascaras Pestañas', 'estetica', 'maquillaje'),
  -- BARBERÍA
  (108, 'Ceras Barbero', 'barberia', 'ceras-barbero'),
  (947, 'Caballero HEY JOE', 'barberia', 'cuidado-caballero'),
  (948, 'Caballero NOVON', 'barberia', 'cuidado-caballero'),
  (949, 'Caballero KUUL for men', 'barberia', 'cuidado-caballero'),
  (946, 'Caballero YUNSEY', 'barberia', 'cuidado-caballero'),
  (292, 'Champu KUUL for men', 'barberia', 'champus-barba'),
  (295, 'Champus barba HEY JOE', 'barberia', 'champus-barba'),
  (945, 'BARBER SHOP', 'barberia', 'barberia-general'),
  (1013, 'COIFFER', 'barberia', 'cuidado-caballero'),
  (1012, 'CANDELAHN', 'barberia', 'cuidado-caballero'),
  (1026, 'CANTU', 'barberia', 'cuidado-caballero'),
  -- Mixtos / peluquería extra
  (119, 'Aparatologia de Peluqueria', 'peluqueria', 'secadores-y-planchas'),
  (443, 'Aceites (oferta)', 'peluqueria', 'ampollas-y-serums'),
  (442, 'Ampollas (Oferta)', 'peluqueria', 'ampollas-y-serums'),
  (526, 'ACONDICIONADORES', 'peluqueria', 'acondicionadores'),
  (548, 'Con amoniaco', 'peluqueria', 'tintes'),
  (549, 'Sin amoniaco', 'peluqueria', 'sin-amoniaco')
ON CONFLICT (woo_cat_id) DO NOTHING;
