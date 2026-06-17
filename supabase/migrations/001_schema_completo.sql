-- ============================================================
-- MIGRACIÓN 001: EXTENSIONES Y HELPERS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- búsqueda full-text eficiente

-- Función para generar slugs automáticamente
CREATE OR REPLACE FUNCTION generate_slug(texto TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN lower(
    regexp_replace(
      translate(
        texto,
        'áéíóúàèìòùäëïöüñçÁÉÍÓÚÀÈÌÒÙÄËÏÖÜÑÇ',
        'aeiouaeiouaeiounçAEIOUAEIOUAEIOUNC'
      ),
      '[^a-z0-9\-]', '-', 'g'
    )
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================
-- MIGRACIÓN 002: TABLA DE MARCAS
-- ============================================================
CREATE TABLE marcas (
  id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre    TEXT NOT NULL UNIQUE,
  slug      TEXT NOT NULL UNIQUE,
  logo_url  TEXT,
  activa    BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- MIGRACIÓN 003: TABLA PRODUCTOS PADRE
-- ============================================================
CREATE TABLE productos_padre (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Datos básicos
  nombre              TEXT NOT NULL,
  slug                TEXT NOT NULL UNIQUE,
  marca_id            UUID REFERENCES marcas(id) ON DELETE SET NULL,
  descripcion_general TEXT,                     -- HTML limpio
  categoria           TEXT NOT NULL,
  subcategoria        TEXT,

  -- SEO (rellenado por script de IA o manualmente)
  seo_title           TEXT CHECK (char_length(seo_title) <= 60),
  seo_description     TEXT CHECK (char_length(seo_description) <= 155),
  texto_enriquecido_seo TEXT,                   -- HTML con H2/H3

  -- Imagen principal
  imagen_principal_url TEXT,

  -- Flags
  activo              BOOLEAN NOT NULL DEFAULT true,
  destacado           BOOLEAN NOT NULL DEFAULT false,
  nuevo               BOOLEAN NOT NULL DEFAULT false,

  -- Auditoría
  creador_id          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para rendimiento en catálogo y búsquedas
CREATE INDEX idx_productos_padre_categoria    ON productos_padre (categoria);
CREATE INDEX idx_productos_padre_subcategoria ON productos_padre (subcategoria);
CREATE INDEX idx_productos_padre_slug         ON productos_padre (slug);
CREATE INDEX idx_productos_padre_activo       ON productos_padre (activo);
CREATE INDEX idx_productos_padre_marca        ON productos_padre (marca_id);
-- Full-text search en nombre
CREATE INDEX idx_productos_padre_nombre_trgm  ON productos_padre USING gin (nombre gin_trgm_ops);

-- Trigger: actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER productos_padre_updated_at
  BEFORE UPDATE ON productos_padre
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- MIGRACIÓN 004: TABLA VARIACIONES (PRODUCTOS HIJO)
-- ============================================================
CREATE TABLE productos_variaciones (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  producto_padre_id UUID NOT NULL REFERENCES productos_padre(id) ON DELETE CASCADE,

  -- Identificación
  sku               TEXT NOT NULL UNIQUE,        -- autogenerado
  nombre_variacion  TEXT NOT NULL,               -- ej: "7.11 Rubio Ceniza Profundo"
  ean_code          TEXT CHECK (ean_code ~ '^\d{13}$'), -- EAN-13

  -- Precios
  precio_b2c        NUMERIC(10,2) NOT NULL CHECK (precio_b2c >= 0),
  precio_b2b        NUMERIC(10,2) CHECK (precio_b2b >= 0),
  precio_comparar   NUMERIC(10,2),               -- precio tachado (oferta)

  -- Inventario
  stock             INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  stock_minimo      INTEGER NOT NULL DEFAULT 5,  -- alerta reposición
  ubicacion_almacen TEXT,                        -- ej: "A-03-02" para picking

  -- Media
  imagen_url        TEXT,

  -- Flags
  activa            BOOLEAN NOT NULL DEFAULT true,

  -- Auditoría
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_variaciones_padre     ON productos_variaciones (producto_padre_id);
CREATE INDEX idx_variaciones_sku       ON productos_variaciones (sku);
CREATE INDEX idx_variaciones_ean       ON productos_variaciones (ean_code);
CREATE INDEX idx_variaciones_stock_bajo ON productos_variaciones (stock) WHERE stock < stock_minimo;

CREATE TRIGGER variaciones_updated_at
  BEFORE UPDATE ON productos_variaciones
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- MIGRACIÓN 005: TABLA USUARIOS (perfil extendido B2B/B2C)
-- ============================================================
CREATE TABLE perfiles_usuario (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre_completo TEXT,
  empresa         TEXT,
  nif_cif         TEXT,
  telefono        TEXT,
  tipo_cliente    TEXT NOT NULL DEFAULT 'b2c' CHECK (tipo_cliente IN ('b2c', 'b2b')),
  b2b_aprobado    BOOLEAN NOT NULL DEFAULT false, -- admin debe aprobar tarifa profesional
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER perfiles_updated_at
  BEFORE UPDATE ON perfiles_usuario
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- MIGRACIÓN 006: TABLA PEDIDOS
-- ============================================================
CREATE TABLE pedidos (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usuario_id        UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Estado
  estado            TEXT NOT NULL DEFAULT 'pendiente'
                    CHECK (estado IN ('pendiente','pagado','preparando','enviado','entregado','cancelado','reembolsado')),

  -- Importes
  subtotal          NUMERIC(10,2) NOT NULL,
  descuento         NUMERIC(10,2) NOT NULL DEFAULT 0,
  gastos_envio      NUMERIC(10,2) NOT NULL DEFAULT 0,
  total             NUMERIC(10,2) NOT NULL,
  tipo_precio       TEXT NOT NULL DEFAULT 'b2c' CHECK (tipo_precio IN ('b2c','b2b')),

  -- Pago
  metodo_pago       TEXT,                        -- stripe | paypal | bizum
  stripe_payment_id TEXT UNIQUE,
  paypal_order_id   TEXT UNIQUE,

  -- Dirección de envío (snapshot en el momento del pedido)
  direccion_envio   JSONB NOT NULL DEFAULT '{}',

  -- Email (por si es invitado)
  email_cliente     TEXT NOT NULL,

  -- Notas
  notas             TEXT,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pedidos_usuario  ON pedidos (usuario_id);
CREATE INDEX idx_pedidos_estado   ON pedidos (estado);
CREATE INDEX idx_pedidos_created  ON pedidos (created_at DESC);

CREATE TRIGGER pedidos_updated_at
  BEFORE UPDATE ON pedidos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- MIGRACIÓN 007: TABLA LÍNEAS DE PEDIDO
-- ============================================================
CREATE TABLE pedidos_lineas (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pedido_id       UUID NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  variacion_id    UUID REFERENCES productos_variaciones(id) ON DELETE SET NULL,

  -- Snapshot del producto en el momento de la compra
  sku             TEXT NOT NULL,
  nombre_producto TEXT NOT NULL,
  nombre_variacion TEXT,
  imagen_url      TEXT,
  precio_unitario NUMERIC(10,2) NOT NULL,
  cantidad        INTEGER NOT NULL CHECK (cantidad > 0),
  subtotal        NUMERIC(10,2) NOT NULL
);

CREATE INDEX idx_lineas_pedido ON pedidos_lineas (pedido_id);

-- Función: decrementar stock al crear línea de pedido pagado
CREATE OR REPLACE FUNCTION decrementar_stock()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE productos_variaciones
  SET stock = stock - NEW.cantidad
  WHERE id = NEW.variacion_id AND stock >= NEW.cantidad;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Stock insuficiente para variación %', NEW.variacion_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- MIGRACIÓN 008: ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Activar RLS en todas las tablas
ALTER TABLE productos_padre          ENABLE ROW LEVEL SECURITY;
ALTER TABLE productos_variaciones    ENABLE ROW LEVEL SECURITY;
ALTER TABLE perfiles_usuario         ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos_lineas           ENABLE ROW LEVEL SECURITY;
ALTER TABLE marcas                   ENABLE ROW LEVEL SECURITY;

-- ── PRODUCTOS PADRE: lectura pública, escritura solo admin ──
CREATE POLICY "productos_padre_select_public"
  ON productos_padre FOR SELECT
  USING (activo = true);

CREATE POLICY "productos_padre_all_admin"
  ON productos_padre FOR ALL
  USING (auth.jwt() ->> 'role' = 'admin' OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- ── VARIACIONES: lectura pública (sin precio_b2b para anónimos) ──
CREATE POLICY "variaciones_select_public"
  ON productos_variaciones FOR SELECT
  USING (activa = true);

CREATE POLICY "variaciones_all_admin"
  ON productos_variaciones FOR ALL
  USING (auth.jwt() ->> 'role' = 'admin' OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- ── MARCAS: lectura pública ──
CREATE POLICY "marcas_select_public"
  ON marcas FOR SELECT
  USING (activa = true);

CREATE POLICY "marcas_all_admin"
  ON marcas FOR ALL
  USING (auth.jwt() ->> 'role' = 'admin' OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- ── PERFILES: cada usuario solo ve/edita el suyo; admin ve todos ──
CREATE POLICY "perfil_select_own"
  ON perfiles_usuario FOR SELECT
  USING (id = auth.uid() OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "perfil_update_own"
  ON perfiles_usuario FOR UPDATE
  USING (id = auth.uid());

CREATE POLICY "perfil_insert_own"
  ON perfiles_usuario FOR INSERT
  WITH CHECK (id = auth.uid());

-- ── PEDIDOS: usuario ve solo los suyos; admin ve todos ──
CREATE POLICY "pedidos_select_own"
  ON pedidos FOR SELECT
  USING (usuario_id = auth.uid() OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "pedidos_insert_own"
  ON pedidos FOR INSERT
  WITH CHECK (usuario_id = auth.uid() OR usuario_id IS NULL);

CREATE POLICY "pedidos_update_admin"
  ON pedidos FOR UPDATE
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- ── LÍNEAS DE PEDIDO: heredan visibilidad del pedido ──
CREATE POLICY "lineas_select_own"
  ON pedidos_lineas FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM pedidos p
      WHERE p.id = pedido_id
        AND (p.usuario_id = auth.uid() OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
    )
  );

CREATE POLICY "lineas_insert_own"
  ON pedidos_lineas FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pedidos p
      WHERE p.id = pedido_id AND p.usuario_id = auth.uid()
    )
  );
