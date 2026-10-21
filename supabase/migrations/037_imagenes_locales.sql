-- ============================================================
-- MIGRACIÓN 037: Imágenes locales (espejo)
-- ============================================================
-- La importación diaria sigue escribiendo la URL del proveedor en
-- imagen_principal_url / imagen_url (depeluqueriaproductos.com).
-- Estas columnas guardan la copia servida desde Supabase Storage:
-- la web muestra imagen_local_url si existe y si no la de origen,
-- de modo que las fotos no dependen del servidor del proveedor sin
-- interferir en la sincronización diaria.
--
-- imagen_origen_url registra la URL copiada: si el proveedor cambia
-- la imagen, la comparación detecta el cambio y se vuelve a copiar.
-- ============================================================

ALTER TABLE productos_padre
  ADD COLUMN IF NOT EXISTS imagen_local_url text,
  ADD COLUMN IF NOT EXISTS imagen_origen_url text;

ALTER TABLE productos_variaciones
  ADD COLUMN IF NOT EXISTS imagen_local_url text,
  ADD COLUMN IF NOT EXISTS imagen_origen_url text;
