-- ============================================================
-- MIGRACIÓN 006: CAMPOS DE COMISIÓN Y GESTIÓN EN PEDIDOS
-- ============================================================

-- Coste que se paga a depeluqueriaproductos al lanzar el pedido
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS coste_proveedor  NUMERIC(10,2);
-- Ganancia neta = total - gastos_envio - coste_proveedor
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS ganancia_neta     NUMERIC(10,2);
-- Notas internas del admin (no visibles al cliente)
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS notas_internas    TEXT;
-- ID del pedido creado en WooCommerce (depeluqueriaproductos.com)
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS woo_order_id      INTEGER;
-- Estado del envío a WooCommerce
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS woo_estado        TEXT
  CHECK (woo_estado IN ('pendiente','enviado','error')) DEFAULT 'pendiente';
-- Fecha en que se lanzó el pedido a WooCommerce
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS woo_enviado_at    TIMESTAMPTZ;
