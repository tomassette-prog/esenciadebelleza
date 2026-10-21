-- ============================================================
-- MIGRACIÓN 041: infraestructura de conversión (emails automáticos)
-- ============================================================
-- 1) Reseñas post-pedido: se marca cuándo se pidió la reseña.
-- 2) Avisos de reposición: clientes que quieren aviso cuando un
--    producto agotado vuelve a tener stock (el stock lo pone el
--    proveedor; nosotros observamos el cambio y avisamos).
-- 3) Carritos abandonados: snapshot del carrito con el email del
--    checkout para poder recuperarlo con un enlace.
-- Escrituras siempre desde server actions/cron (service_role).
-- ============================================================

ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS resena_solicitada_at timestamptz;

CREATE TABLE IF NOT EXISTS avisos_reposicion (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id  uuid NOT NULL REFERENCES productos_padre(id) ON DELETE CASCADE,
  variacion_id uuid REFERENCES productos_variaciones(id) ON DELETE CASCADE,
  email        text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  notificado_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS avisos_reposicion_unicos
  ON avisos_reposicion (producto_id, email);
CREATE INDEX IF NOT EXISTS avisos_reposicion_pendientes
  ON avisos_reposicion (producto_id) WHERE notificado_at IS NULL;

CREATE TABLE IF NOT EXISTS carritos_abandonados (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email                 text NOT NULL,
  items                 jsonb NOT NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  converted_at          timestamptz,
  recordatorio_enviado_at timestamptz
);

CREATE INDEX IF NOT EXISTS carritos_abandonados_pendientes
  ON carritos_abandonados (created_at) WHERE recordatorio_enviado_at IS NULL;

ALTER TABLE avisos_reposicion     ENABLE ROW LEVEL SECURITY;
ALTER TABLE carritos_abandonados  ENABLE ROW LEVEL SECURITY;
