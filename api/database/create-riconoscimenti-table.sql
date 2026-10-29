-- Tabella per le richieste di riconoscimento ruolo politico/candidato
-- Ogni riga rappresenta una richiesta, inclusi esito e riferimenti pubblici.

CREATE TABLE IF NOT EXISTS riconoscimenti (
  id VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tipo_ruolo VARCHAR(2) NOT NULL CHECK (tipo_ruolo IN ('P', 'C', 'CP')),
  nome VARCHAR(255) NOT NULL,
  cognome VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  -- Dati di elezione (solo per P o CP)
  paese_elezione VARCHAR(100),
  regione_elezione VARCHAR(100),
  provincia_elezione VARCHAR(100),
  comune_elezione VARCHAR(100),
  grado_elezione VARCHAR(100),
  -- Dati di candidatura (solo per C o CP)
  paese_candidatura VARCHAR(100),
  regione_candidatura VARCHAR(100),
  provincia_candidatura VARCHAR(100),
  comune_candidatura VARCHAR(100),
  grado_candidatura VARCHAR(100),
  fonte_elezione_url TEXT,
  fonte_candidatura_url TEXT,
  status VARCHAR(16) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  decision_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_riconoscimenti_user_id
  ON riconoscimenti(user_id);

