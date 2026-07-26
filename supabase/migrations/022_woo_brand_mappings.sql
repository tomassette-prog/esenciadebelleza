-- Migration 022: WooCommerce brand mappings table
CREATE TABLE IF NOT EXISTS woo_brand_mappings (
  woo_brand_name  TEXT PRIMARY KEY,
  marca_id        UUID REFERENCES marcas(id) ON DELETE SET NULL,
  is_new_brand    BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE woo_brand_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "woo_brand_mappings_public_read" ON woo_brand_mappings
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "woo_brand_mappings_service_write" ON woo_brand_mappings
  FOR ALL TO service_role USING (true);
