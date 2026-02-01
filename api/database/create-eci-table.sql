-- Tabella ECI: cache delle Iniziative dei Cittadini Europei da Decidim (API GraphQL)
-- Usata come fallback/cache quando l'API GraphQL Decidim non è disponibile o per ridurre le chiamate.
CREATE TABLE IF NOT EXISTS eci (
    id VARCHAR(255) PRIMARY KEY,
    title TEXT NOT NULL,
    signature_count INTEGER DEFAULT 0,
    slug VARCHAR(255),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_eci_signature_count ON eci(signature_count DESC);
CREATE INDEX IF NOT EXISTS idx_eci_updated_at ON eci(updated_at);

COMMENT ON TABLE eci IS 'Iniziative ECI (European Citizens Initiative) da Decidim GraphQL - cache/fallback';
