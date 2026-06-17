-- Grants explícitos para PostgREST (service_role, authenticated, anon)
-- Necesarios porque la migración 001 no los incluía

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT SELECT                       ON marcas                TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON marcas              TO service_role;

GRANT SELECT                       ON productos_padre       TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON productos_padre     TO service_role;

GRANT SELECT                       ON productos_variaciones TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON productos_variaciones TO service_role;

GRANT SELECT                       ON perfiles_usuario      TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON perfiles_usuario    TO service_role;

GRANT SELECT                       ON pedidos               TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON pedidos             TO service_role;

GRANT SELECT                       ON pedidos_lineas        TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON pedidos_lineas      TO service_role;

-- Sequences (para UUIDs generados)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
