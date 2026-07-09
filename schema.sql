CREATE TABLE IF NOT EXISTS ovrload_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100) NOT NULL,
  unit_price_usd DECIMAL(10, 2) NOT NULL,
  image_url TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS ovrload_categories (
  name VARCHAR(100) PRIMARY KEY,
  sort_order INTEGER DEFAULT 0
);
