-- DEMOS staging-only baseline for an empty PostgreSQL database.
-- Mirrors only the pre-existing legacy structures required by the functional migration bundle.
-- Contains no production data and is never selected by the normal production migration path.
BEGIN;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255),
  email VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  ruolo VARCHAR(50) DEFAULT 'Elettore',
  status VARCHAR(50) DEFAULT 'pending',
  nome TEXT,
  cognome TEXT,
  paese_residenza VARCHAR(100),
  regione_residenza VARCHAR(100),
  provincia_residenza VARCHAR(100),
  comune_residenza VARCHAR(100),
  paese_elezione VARCHAR(100),
  regione_elezione VARCHAR(100),
  provincia_elezione VARCHAR(100),
  comune_elezione VARCHAR(100),
  grado_elezione VARCHAR(100),
  paese_candidatura VARCHAR(100),
  regione_candidatura VARCHAR(100),
  provincia_candidatura VARCHAR(100),
  comune_candidatura VARCHAR(100),
  grado_candidatura VARCHAR(100),
  rappresentante_europeo TEXT,
  rappresentante_camera TEXT,
  rappresentante_senato TEXT,
  rappresentante_regionale TEXT,
  rappresentante_comune TEXT,
  candidato_europeo TEXT,
  candidato_camera TEXT,
  candidato_senato TEXT,
  candidato_regionale TEXT,
  candidato_comune TEXT
);

CREATE TABLE IF NOT EXISTS eventi (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_evento VARCHAR(255) NOT NULL,
  tipologia_evento VARCHAR(255) NOT NULL,
  paese_evento VARCHAR(100),
  regione_evento VARCHAR(100),
  provincia_evento VARCHAR(100),
  comune_evento VARCHAR(100),
  indirizzo_evento TEXT,
  orario_evento TIME,
  inizio_evento TIMESTAMP,
  fine_evento TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  organizzatore VARCHAR(255),
  giorno_inizio DATE,
  giorno_fine DATE,
  orario_inizio TIME,
  orario_fine TIME,
  tipo_elezione VARCHAR(100),
  orario_inizio_giorno2 TIME,
  orario_fine_giorno2 TIME
);

CREATE TABLE IF NOT EXISTS programmi (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  utente_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  proposta_1 TEXT,
  proposta_2 TEXT,
  proposta_3 TEXT,
  proposta_4 TEXT,
  proposta_5 TEXT,
  url_1 TEXT,
  url_2 TEXT,
  url_3 TEXT,
  url_4 TEXT,
  url_5 TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

COMMIT;
