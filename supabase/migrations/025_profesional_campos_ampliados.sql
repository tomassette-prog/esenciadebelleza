-- Añadir campos de registro profesional ampliado
-- Direcciones, persona de contacto, tipo de negocio

ALTER TABLE perfiles_usuario
  ADD COLUMN IF NOT EXISTS direccion_envio     JSONB,
  ADD COLUMN IF NOT EXISTS direccion_facturacion JSONB,
  ADD COLUMN IF NOT EXISTS telefono_contacto   TEXT,
  ADD COLUMN IF NOT EXISTS tipo_negocio        TEXT,
  ADD COLUMN IF NOT EXISTS web_instagram       TEXT;

COMMENT ON COLUMN perfiles_usuario.direccion_envio IS
  'Dirección de envío del profesional: {calle, cp, ciudad, provincia}';
COMMENT ON COLUMN perfiles_usuario.direccion_facturacion IS
  'Dirección de facturación si es distinta a la de envío';
COMMENT ON COLUMN perfiles_usuario.telefono_contacto IS
  'Teléfono de la persona de contacto (puede diferir del teléfono del negocio)';
COMMENT ON COLUMN perfiles_usuario.tipo_negocio IS
  'Tipo de negocio: salon, clinica, barberia, spa, distribuidor, otro';
COMMENT ON COLUMN perfiles_usuario.web_instagram IS
  'Web o Instagram del negocio (verificación)';
