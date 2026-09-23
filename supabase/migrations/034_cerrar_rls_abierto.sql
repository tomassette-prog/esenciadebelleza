-- 034: Close open RLS policies (the public anon key could read/write too much)
--
-- Why: several tables had permissive policies created with the anon key in
-- mind (USING (true)) or no RLS at all, so anyone with the public anon key
-- (it ships in the browser bundle) could edit blog posts, create coupons or
-- grant themselves B2B status. The app always writes through service_role,
-- so closing these does not affect any legitimate flow.
--
-- Apply in the Supabase SQL Editor. Idempotent (safe to run multiple times).

-- ── Blog y carruseles: solo la app (service_role) escribe; lectura pública ───
DROP POLICY IF EXISTS posts_admin_all ON posts;
DROP POLICY IF EXISTS carruseles_admin_all ON carruseles;
DROP POLICY IF EXISTS carrusel_productos_admin_all ON carrusel_productos;
DROP POLICY IF EXISTS posts_read_all ON posts;
DROP POLICY IF EXISTS carruseles_read_all ON carruseles;
DROP POLICY IF EXISTS carrusel_productos_read_all ON carrusel_productos;
CREATE POLICY posts_read_all ON posts FOR SELECT USING (true);
CREATE POLICY carruseles_read_all ON carruseles FOR SELECT USING (true);
CREATE POLICY carrusel_productos_read_all ON carrusel_productos FOR SELECT USING (true);

-- ── Cupones: sin RLS cualquiera podía leer códigos y crear cupones ───────────
ALTER TABLE cupones ENABLE ROW LEVEL SECURITY;
ALTER TABLE cupones_uso ENABLE ROW LEVEL SECURITY;

-- ── Config de tienda: lectura pública (la usa el checkout), escritura app ────
ALTER TABLE config_tienda ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS config_tienda_read_all ON config_tienda;
CREATE POLICY config_tienda_read_all ON config_tienda FOR SELECT USING (true);

-- ── Pedidos: quitar INSERT público (la app inserta siempre con service_role) ─
DROP POLICY IF EXISTS pedidos_insert_own ON pedidos;

-- ── Perfil: nadie puede auto-aprobarse B2B ni fijar su propio descuento ──────
REVOKE UPDATE (tipo_cliente, b2b_aprobado, descuento_b2b) ON perfiles_usuario FROM anon, authenticated;
