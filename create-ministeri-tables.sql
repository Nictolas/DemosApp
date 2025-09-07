-- Creazione tabelle separate per ogni ministero
-- Questo script crea 12 tabelle separate per ottimizzare le performance

-- Lista dei ministeri
-- difesa, economia, esteri, giustizia, interno, istruzione, lavoro, salute, trasporti, ambiente, cultura, sport

-- 1. Difesa
CREATE TABLE IF NOT EXISTS voti_ministro_difesa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  userid UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nome_ministro VARCHAR(255) NOT NULL,
  nome_display VARCHAR(255) NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_voti_ministro_difesa_userid ON voti_ministro_difesa(userid);
CREATE INDEX IF NOT EXISTS idx_voti_ministro_difesa_timestamp ON voti_ministro_difesa(timestamp);
CREATE INDEX IF NOT EXISTS idx_voti_ministro_difesa_nome_ministro ON voti_ministro_difesa(nome_ministro);
CREATE INDEX IF NOT EXISTS idx_voti_ministro_difesa_nome_display ON voti_ministro_difesa(nome_display);

-- 2. Economia
CREATE TABLE IF NOT EXISTS voti_ministro_economia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  userid UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nome_ministro VARCHAR(255) NOT NULL,
  nome_display VARCHAR(255) NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_voti_ministro_economia_userid ON voti_ministro_economia(userid);
CREATE INDEX IF NOT EXISTS idx_voti_ministro_economia_timestamp ON voti_ministro_economia(timestamp);
CREATE INDEX IF NOT EXISTS idx_voti_ministro_economia_nome_ministro ON voti_ministro_economia(nome_ministro);
CREATE INDEX IF NOT EXISTS idx_voti_ministro_economia_nome_display ON voti_ministro_economia(nome_display);

-- 3. Esteri
CREATE TABLE IF NOT EXISTS voti_ministro_esteri (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  userid UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nome_ministro VARCHAR(255) NOT NULL,
  nome_display VARCHAR(255) NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_voti_ministro_esteri_userid ON voti_ministro_esteri(userid);
CREATE INDEX IF NOT EXISTS idx_voti_ministro_esteri_timestamp ON voti_ministro_esteri(timestamp);
CREATE INDEX IF NOT EXISTS idx_voti_ministro_esteri_nome_ministro ON voti_ministro_esteri(nome_ministro);
CREATE INDEX IF NOT EXISTS idx_voti_ministro_esteri_nome_display ON voti_ministro_esteri(nome_display);

-- 4. Giustizia
CREATE TABLE IF NOT EXISTS voti_ministro_giustizia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  userid UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nome_ministro VARCHAR(255) NOT NULL,
  nome_display VARCHAR(255) NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_voti_ministro_giustizia_userid ON voti_ministro_giustizia(userid);
CREATE INDEX IF NOT EXISTS idx_voti_ministro_giustizia_timestamp ON voti_ministro_giustizia(timestamp);
CREATE INDEX IF NOT EXISTS idx_voti_ministro_giustizia_nome_ministro ON voti_ministro_giustizia(nome_ministro);
CREATE INDEX IF NOT EXISTS idx_voti_ministro_giustizia_nome_display ON voti_ministro_giustizia(nome_display);

-- 5. Interno
CREATE TABLE IF NOT EXISTS voti_ministro_interno (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  userid UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nome_ministro VARCHAR(255) NOT NULL,
  nome_display VARCHAR(255) NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_voti_ministro_interno_userid ON voti_ministro_interno(userid);
CREATE INDEX IF NOT EXISTS idx_voti_ministro_interno_timestamp ON voti_ministro_interno(timestamp);
CREATE INDEX IF NOT EXISTS idx_voti_ministro_interno_nome_ministro ON voti_ministro_interno(nome_ministro);
CREATE INDEX IF NOT EXISTS idx_voti_ministro_interno_nome_display ON voti_ministro_interno(nome_display);

-- 6. Istruzione
CREATE TABLE IF NOT EXISTS voti_ministro_istruzione (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  userid UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nome_ministro VARCHAR(255) NOT NULL,
  nome_display VARCHAR(255) NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_voti_ministro_istruzione_userid ON voti_ministro_istruzione(userid);
CREATE INDEX IF NOT EXISTS idx_voti_ministro_istruzione_timestamp ON voti_ministro_istruzione(timestamp);
CREATE INDEX IF NOT EXISTS idx_voti_ministro_istruzione_nome_ministro ON voti_ministro_istruzione(nome_ministro);
CREATE INDEX IF NOT EXISTS idx_voti_ministro_istruzione_nome_display ON voti_ministro_istruzione(nome_display);

-- 7. Lavoro
CREATE TABLE IF NOT EXISTS voti_ministro_lavoro (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  userid UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nome_ministro VARCHAR(255) NOT NULL,
  nome_display VARCHAR(255) NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_voti_ministro_lavoro_userid ON voti_ministro_lavoro(userid);
CREATE INDEX IF NOT EXISTS idx_voti_ministro_lavoro_timestamp ON voti_ministro_lavoro(timestamp);
CREATE INDEX IF NOT EXISTS idx_voti_ministro_lavoro_nome_ministro ON voti_ministro_lavoro(nome_ministro);
CREATE INDEX IF NOT EXISTS idx_voti_ministro_lavoro_nome_display ON voti_ministro_lavoro(nome_display);

-- 8. Salute
CREATE TABLE IF NOT EXISTS voti_ministro_salute (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  userid UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nome_ministro VARCHAR(255) NOT NULL,
  nome_display VARCHAR(255) NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_voti_ministro_salute_userid ON voti_ministro_salute(userid);
CREATE INDEX IF NOT EXISTS idx_voti_ministro_salute_timestamp ON voti_ministro_salute(timestamp);
CREATE INDEX IF NOT EXISTS idx_voti_ministro_salute_nome_ministro ON voti_ministro_salute(nome_ministro);
CREATE INDEX IF NOT EXISTS idx_voti_ministro_salute_nome_display ON voti_ministro_salute(nome_display);

-- 9. Trasporti
CREATE TABLE IF NOT EXISTS voti_ministro_trasporti (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  userid UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nome_ministro VARCHAR(255) NOT NULL,
  nome_display VARCHAR(255) NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_voti_ministro_trasporti_userid ON voti_ministro_trasporti(userid);
CREATE INDEX IF NOT EXISTS idx_voti_ministro_trasporti_timestamp ON voti_ministro_trasporti(timestamp);
CREATE INDEX IF NOT EXISTS idx_voti_ministro_trasporti_nome_ministro ON voti_ministro_trasporti(nome_ministro);
CREATE INDEX IF NOT EXISTS idx_voti_ministro_trasporti_nome_display ON voti_ministro_trasporti(nome_display);

-- 10. Ambiente
CREATE TABLE IF NOT EXISTS voti_ministro_ambiente (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  userid UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nome_ministro VARCHAR(255) NOT NULL,
  nome_display VARCHAR(255) NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_voti_ministro_ambiente_userid ON voti_ministro_ambiente(userid);
CREATE INDEX IF NOT EXISTS idx_voti_ministro_ambiente_timestamp ON voti_ministro_ambiente(timestamp);
CREATE INDEX IF NOT EXISTS idx_voti_ministro_ambiente_nome_ministro ON voti_ministro_ambiente(nome_ministro);
CREATE INDEX IF NOT EXISTS idx_voti_ministro_ambiente_nome_display ON voti_ministro_ambiente(nome_display);

-- 11. Cultura
CREATE TABLE IF NOT EXISTS voti_ministro_cultura (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  userid UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nome_ministro VARCHAR(255) NOT NULL,
  nome_display VARCHAR(255) NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_voti_ministro_cultura_userid ON voti_ministro_cultura(userid);
CREATE INDEX IF NOT EXISTS idx_voti_ministro_cultura_timestamp ON voti_ministro_cultura(timestamp);
CREATE INDEX IF NOT EXISTS idx_voti_ministro_cultura_nome_ministro ON voti_ministro_cultura(nome_ministro);
CREATE INDEX IF NOT EXISTS idx_voti_ministro_cultura_nome_display ON voti_ministro_cultura(nome_display);

-- 12. Sport
CREATE TABLE IF NOT EXISTS voti_ministro_sport (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  userid UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nome_ministro VARCHAR(255) NOT NULL,
  nome_display VARCHAR(255) NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_voti_ministro_sport_userid ON voti_ministro_sport(userid);
CREATE INDEX IF NOT EXISTS idx_voti_ministro_sport_timestamp ON voti_ministro_sport(timestamp);
CREATE INDEX IF NOT EXISTS idx_voti_ministro_sport_nome_ministro ON voti_ministro_sport(nome_ministro);
CREATE INDEX IF NOT EXISTS idx_voti_ministro_sport_nome_display ON voti_ministro_sport(nome_display);

-- Messaggio di completamento
SELECT 'Tutte le tabelle ministeri create con successo!' as status;
