-- Verificar si la tabla existe
SELECT EXISTS (
  SELECT 1 FROM information_schema.tables 
  WHERE table_name = 'subcategorias'
) as tabla_existe;

-- Si la tabla no tiene datos, llenarla
INSERT INTO subcategorias (categoria, slug, label, columna, orden) VALUES
-- PELUQUERÍA - Coloración
('peluqueria', 'tintes', 'Tintes', 'Coloración', 1),
('peluqueria', 'decoloracion', 'Decoloración', 'Coloración', 2),
('peluqueria', 'oxigenadas', 'Oxigenadas', 'Coloración', 3),
('peluqueria', 'sin-amoniaco', 'Sin amoniaco', 'Coloración', 4),
-- PELUQUERÍA - Cuidado Capilar
('peluqueria', 'champus', 'Champús', 'Cuidado Capilar', 5),
('peluqueria', 'mascarillas', 'Mascarillas', 'Cuidado Capilar', 6),
('peluqueria', 'acondicionadores', 'Acondicionadores', 'Cuidado Capilar', 7),
('peluqueria', 'ampollas-y-serums', 'Ampollas y Sérums', 'Cuidado Capilar', 8),
('peluqueria', 'tratamientos', 'Tratamientos', 'Cuidado Capilar', 9),
-- PELUQUERÍA - Styling
('peluqueria', 'lacas', 'Lacas', 'Styling', 10),
('peluqueria', 'espumas', 'Espumas', 'Styling', 11),
('peluqueria', 'gominas-y-ceras', 'Gominas y Ceras', 'Styling', 12),
('peluqueria', 'rizos', 'Rizos y Anticrespo', 'Styling', 13),
('peluqueria', 'permanentes', 'Permanentes', 'Styling', 14),
-- PELUQUERÍA - Equipos y Herramientas
('peluqueria', 'secadores-y-planchas', 'Secadores y Planchas', 'Equipos y Herramientas', 15),
('peluqueria', 'maquinas-corte', 'Máquinas de corte', 'Equipos y Herramientas', 16),
('peluqueria', 'cepillos-y-peines', 'Cepillos y Peines', 'Equipos y Herramientas', 17),
('peluqueria', 'tijeras', 'Tijeras y Navajas', 'Equipos y Herramientas', 18),
('peluqueria', 'batas-y-capas', 'Batas y Capas', 'Equipos y Herramientas', 19),
('peluqueria', 'utensilios', 'Utensilios y Accesorios', 'Equipos y Herramientas', 20),
('peluqueria', 'mobiliario', 'Mobiliario', 'Equipos y Herramientas', 21),
-- ESTÉTICA - Facial
('estetica', 'cremas-faciales', 'Cremas faciales', 'Facial', 22),
('estetica', 'mascarillas-faciales', 'Mascarillas faciales', 'Facial', 23),
('estetica', 'serums-faciales', 'Sérums y Contorno de ojos', 'Facial', 24),
('estetica', 'gel-facial', 'Gel facial y limpieza', 'Facial', 25),
-- ESTÉTICA - Corporal
('estetica', 'cremas-corporales', 'Cremas corporales', 'Corporal', 26),
('estetica', 'aceites-corporales', 'Aceites corporales', 'Corporal', 27),
('estetica', 'leche-corporal', 'Leche corporal', 'Corporal', 28),
('estetica', 'gel-corporal', 'Gel de ducha', 'Corporal', 29),
('estetica', 'peeling', 'Peeling y Exfoliantes', 'Corporal', 30),
-- ESTÉTICA - Depilación
('estetica', 'ceras-depiladoras', 'Ceras depiladoras', 'Depilación', 31),
('estetica', 'depilatorios', 'Depilatorios', 'Depilación', 32),
-- ESTÉTICA - Uñas y Maquillaje
('estetica', 'manicura-pedicura', 'Manicura y Pedicura', 'Uñas y Maquillaje', 33),
('estetica', 'unas', 'Limas y Fresas', 'Uñas y Maquillaje', 34),
('estetica', 'lamparas-uv', 'Lámparas UV/LED', 'Uñas y Maquillaje', 35),
('estetica', 'maquillaje', 'Maquillaje', 'Uñas y Maquillaje', 36),
-- BARBERÍA - Afeitado y Barba
('barberia', 'ceras-barbero', 'Ceras de barbero', 'Afeitado y Barba', 37),
('barberia', 'champus-barba', 'Champús de barba', 'Afeitado y Barba', 38),
-- BARBERÍA - Styling y cuidado caballero
('barberia', 'cuidado-caballero', 'Cuidado caballero', 'Styling y cuidado caballero', 39),
-- PERFUMERÍA - Perfumes
('perfumeria', 'eau-de-parfum', 'Eau de Parfum', 'Perfumes', 40),
('perfumeria', 'eau-de-toilette', 'Eau de Toilette', 'Perfumes', 41),
('perfumeria', 'colonias', 'Colonias', 'Perfumes', 42),
-- PERFUMERÍA - Ambientación
('perfumeria', 'ambientadores', 'Ambientadores', 'Ambientación', 43),
('perfumeria', 'brumas-y-velas', 'Brumas y Velas', 'Ambientación', 44)
ON CONFLICT (categoria, slug) DO NOTHING;

-- Verificar el resultado
SELECT COUNT(*) as total_subcategorias, categoria, COUNT(*) FROM subcategorias GROUP BY categoria ORDER BY categoria;
