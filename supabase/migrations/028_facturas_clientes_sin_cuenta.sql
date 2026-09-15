-- Hacer profesional_id nullable para soportar clientes sin cuenta
ALTER TABLE facturas ALTER COLUMN profesional_id DROP NOT NULL;

-- Añadir email_cliente para identificar clientes sin cuenta
ALTER TABLE facturas ADD COLUMN IF NOT EXISTS email_cliente TEXT;

-- Actualizar RLS para que también funcione con email_cliente
DROP POLICY IF EXISTS "Profesional ve sus facturas" ON facturas;

CREATE POLICY "Profesional ve sus facturas"
  ON facturas FOR SELECT
  USING (
    auth.uid() = profesional_id
    OR email_cliente = (SELECT email FROM auth.users WHERE id = auth.uid())
  );
