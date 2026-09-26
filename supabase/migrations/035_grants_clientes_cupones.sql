-- Grants missing for tables created in 010_cupones_descuento.sql and
-- 033_clientes_registro.sql (those migrations never granted table ACLs).
--
-- Symptoms this fixes (2026-09-24, production):
--   * EVERY pedido INSERT failed: trg_registrar_cliente (SECURITY INVOKER,
--     runs as service_role) hit 42501 "permission denied for table clientes"
--     and the whole INSERT rolled back. With the old checkout code this also
--     created the Stripe session anyway -> customer could pay with no order.
--   * Coupon lookup silently failed (SELECT on cupones denied -> discount 0).
--   * registrarUsoCupon could not record usage (INSERT on cupones_uso denied).
--
-- PostgREST runs as service_role: it BYPASSES RLS but NOT table ACLs, so a
-- GRANT is required even for the "admin" role.

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clientes    TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cupones     TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cupones_uso TO service_role;
