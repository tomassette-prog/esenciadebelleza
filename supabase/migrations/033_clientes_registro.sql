-- 033: Client registry created automatically from orders (no login required)
--
-- Why: guest checkout only stores buyer data as a snapshot inside `pedidos`,
-- so buyers never appear in /admin/clientes and repeat buyers cannot be
-- deduplicated. This migration materializes a `clientes` table keyed by email
-- (UNIQUE, enforced by the database), fed by a trigger on `pedidos` so that
-- ALL payment flows (and future ones) are covered without touching app code.
--
-- Apply in the Supabase SQL Editor. Safe to run multiple times.

CREATE TABLE IF NOT EXISTS clientes (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email                 TEXT NOT NULL UNIQUE CHECK (email = lower(email)),
  nombre_completo       TEXT,
  telefono              TEXT,
  empresa               TEXT,
  nif_cif               TEXT,
  usuario_id            UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  tipo_cliente          TEXT NOT NULL DEFAULT 'b2c' CHECK (tipo_cliente IN ('b2c', 'b2b')),
  direccion_envio       JSONB,
  direccion_facturacion JSONB,
  total_pedidos         INTEGER NOT NULL DEFAULT 0,
  total_gastado         NUMERIC(12,2) NOT NULL DEFAULT 0,
  ultimo_pedido_at      TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_clientes_usuario_id ON clientes (usuario_id);
CREATE INDEX IF NOT EXISTS idx_clientes_nombre ON clientes (nombre_completo);
CREATE INDEX IF NOT EXISTS idx_pedidos_email_cliente ON pedidos (lower(email_cliente));

-- ── Trigger: every new order creates/updates its client (dedupe by email) ────
CREATE OR REPLACE FUNCTION registrar_cliente_desde_pedido()
RETURNS TRIGGER AS $$
DECLARE
  de         JSONB := COALESCE(NEW.direccion_envio, '{}'::jsonb);
  email_norm TEXT  := lower(btrim(COALESCE(NEW.email_cliente, '')));
BEGIN
  IF email_norm = '' THEN
    RETURN NEW;
  END IF;

  INSERT INTO clientes (
    email, nombre_completo, telefono, empresa, nif_cif, usuario_id, tipo_cliente,
    direccion_envio, direccion_facturacion, total_pedidos, total_gastado, ultimo_pedido_at
  ) VALUES (
    email_norm,
    NULLIF(btrim(COALESCE(de->>'nombre', '') || ' ' || COALESCE(de->>'apellidos', '')), ''),
    NULLIF(btrim(COALESCE(de->>'telefono', '')), ''),
    NULLIF(btrim(COALESCE(de->'facturacion'->>'empresa', '')), ''),
    NULLIF(btrim(COALESCE(de->'facturacion'->>'nif_cif', '')), ''),
    NEW.usuario_id,
    CASE WHEN NEW.tipo_precio = 'b2b' THEN 'b2b' ELSE 'b2c' END,
    jsonb_build_object(
      'nombre',    de->>'nombre',
      'apellidos', de->>'apellidos',
      'telefono',  de->>'telefono',
      'calle',     de->>'direccion',
      'cp',        de->>'codigo_postal',
      'ciudad',    de->>'ciudad',
      'provincia', de->>'provincia'
    ),
    de->'facturacion',
    1,
    COALESCE(NEW.total, 0),
    COALESCE(NEW.created_at, now())
  )
  ON CONFLICT (email) DO UPDATE SET
    nombre_completo       = COALESCE(EXCLUDED.nombre_completo, clientes.nombre_completo),
    telefono              = COALESCE(EXCLUDED.telefono, clientes.telefono),
    empresa               = COALESCE(EXCLUDED.empresa, clientes.empresa),
    nif_cif               = COALESCE(EXCLUDED.nif_cif, clientes.nif_cif),
    usuario_id            = COALESCE(clientes.usuario_id, EXCLUDED.usuario_id),
    tipo_cliente          = CASE
                              WHEN clientes.tipo_cliente = 'b2b' OR EXCLUDED.tipo_cliente = 'b2b'
                              THEN 'b2b' ELSE 'b2c'
                            END,
    direccion_envio       = COALESCE(EXCLUDED.direccion_envio, clientes.direccion_envio),
    direccion_facturacion = COALESCE(EXCLUDED.direccion_facturacion, clientes.direccion_facturacion),
    total_pedidos         = clientes.total_pedidos + 1,
    total_gastado         = clientes.total_gastado + COALESCE(NEW.total, 0),
    ultimo_pedido_at      = GREATEST(
                              COALESCE(clientes.ultimo_pedido_at, COALESCE(NEW.created_at, now())),
                              COALESCE(NEW.created_at, now())
                            ),
    updated_at            = now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_registrar_cliente ON pedidos;
CREATE TRIGGER trg_registrar_cliente
  AFTER INSERT ON pedidos
  FOR EACH ROW EXECUTE FUNCTION registrar_cliente_desde_pedido();

-- ── updated_at maintenance (shared convention from 001_schema_completo.sql) ──
DROP TRIGGER IF EXISTS trg_clientes_updated_at ON clientes;
CREATE TRIGGER trg_clientes_updated_at
  BEFORE UPDATE ON clientes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Backfill: one client per email already present in past orders ────────────
INSERT INTO clientes (
  email, nombre_completo, telefono, empresa, nif_cif, usuario_id, tipo_cliente,
  direccion_envio, direccion_facturacion, total_pedidos, total_gastado,
  ultimo_pedido_at, created_at
)
SELECT
  a.email,
  NULLIF(btrim(COALESCE(u.direccion_envio->>'nombre', '') || ' ' || COALESCE(u.direccion_envio->>'apellidos', '')), ''),
  NULLIF(btrim(COALESCE(u.direccion_envio->>'telefono', '')), ''),
  NULLIF(btrim(COALESCE(u.direccion_envio->'facturacion'->>'empresa', '')), ''),
  NULLIF(btrim(COALESCE(u.direccion_envio->'facturacion'->>'nif_cif', '')), ''),
  a.usuario_id,
  CASE WHEN a.es_b2b = 1 THEN 'b2b' ELSE 'b2c' END,
  CASE WHEN u.direccion_envio IS NOT NULL THEN jsonb_build_object(
      'nombre',    u.direccion_envio->>'nombre',
      'apellidos', u.direccion_envio->>'apellidos',
      'telefono',  u.direccion_envio->>'telefono',
      'calle',     u.direccion_envio->>'direccion',
      'cp',        u.direccion_envio->>'codigo_postal',
      'ciudad',    u.direccion_envio->>'ciudad',
      'provincia', u.direccion_envio->>'provincia'
    ) END,
  u.direccion_envio->'facturacion',
  a.total_pedidos,
  a.total_gastado,
  a.ultimo_pedido_at,
  a.primer_pedido_at
FROM (
  SELECT
    lower(btrim(email_cliente))          AS email,
    count(*)::int                        AS total_pedidos,
    COALESCE(sum(total), 0)              AS total_gastado,
    max(usuario_id)                      AS usuario_id,
    max(CASE WHEN tipo_precio = 'b2b' THEN 1 ELSE 0 END)::int AS es_b2b,
    min(created_at)                      AS primer_pedido_at,
    max(created_at)                      AS ultimo_pedido_at
  FROM pedidos
  WHERE btrim(COALESCE(email_cliente, '')) <> ''
  GROUP BY 1
) a
LEFT JOIN LATERAL (
  SELECT direccion_envio
  FROM pedidos p
  WHERE lower(btrim(p.email_cliente)) = a.email
  ORDER BY p.created_at DESC
  LIMIT 1
) u ON TRUE
ON CONFLICT (email) DO NOTHING;

-- ── Backfill: registered users who never ordered (so they also appear) ───────
INSERT INTO clientes (
  email, nombre_completo, telefono, empresa, nif_cif, usuario_id, tipo_cliente,
  total_pedidos, total_gastado, created_at
)
SELECT
  lower(btrim(au.email)),
  NULLIF(btrim(COALESCE(p.nombre_completo, '')), ''),
  NULLIF(btrim(COALESCE(p.telefono, '')), ''),
  NULLIF(btrim(COALESCE(p.empresa, '')), ''),
  NULLIF(btrim(COALESCE(p.nif_cif, '')), ''),
  p.id,
  CASE WHEN p.tipo_cliente = 'b2b' THEN 'b2b' ELSE 'b2c' END,
  0, 0,
  COALESCE(p.created_at, now())
FROM perfiles_usuario p
JOIN auth.users au ON au.id = p.id
WHERE btrim(COALESCE(au.email, '')) <> ''
ON CONFLICT (email) DO NOTHING;
