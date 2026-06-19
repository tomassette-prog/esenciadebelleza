-- Función para contar productos únicos por categoría (evita duplicados por variaciones)
CREATE OR REPLACE FUNCTION get_category_counts()
RETURNS TABLE(categoria TEXT, total BIGINT)
LANGUAGE SQL STABLE SECURITY DEFINER AS $$
  SELECT pp.categoria, COUNT(DISTINCT pp.id) AS total
  FROM productos_padre pp
  WHERE pp.activo = true
    AND EXISTS (
      SELECT 1 FROM productos_variaciones pv
      WHERE pv.producto_padre_id = pp.id AND pv.activa = true
    )
  GROUP BY pp.categoria
  ORDER BY total DESC;
$$;

GRANT EXECUTE ON FUNCTION get_category_counts() TO anon, authenticated, service_role;
