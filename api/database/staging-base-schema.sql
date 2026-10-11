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
  candidato_comune TEXT,
  privacy_policy_consent BOOLEAN DEFAULT FALSE,
  terms_of_service_consent BOOLEAN DEFAULT FALSE,
  consent_timestamp TIMESTAMPTZ,
  consent_ip_address TEXT,
  consent_user_agent TEXT,
  political_opinions_consent BOOLEAN DEFAULT FALSE,
  political_opinions_consent_timestamp TIMESTAMPTZ,
  political_opinions_consent_ip_address TEXT,
  political_opinions_consent_user_agent TEXT
);

-- CREATE TABLE IF NOT EXISTS does not add columns when users already exists.
-- Reconcile the legacy consent compatibility surface idempotently for long-lived staging databases.
ALTER TABLE users ADD COLUMN IF NOT EXISTS privacy_policy_consent BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_of_service_consent BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS consent_timestamp TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS consent_ip_address TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS consent_user_agent TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS political_opinions_consent BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS political_opinions_consent_timestamp TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS political_opinions_consent_ip_address TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS political_opinions_consent_user_agent TEXT;

-- Legacy Opinioni response store required by /api/opinioni/salva.
-- Individual opinion columns are dynamic; staging E2E may add/drop its own isolated column.
CREATE TABLE IF NOT EXISTS opinioni_risposte (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  fonti_opinioni JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Minimal legacy opinion catalog required by supporter-notification text resolution.
-- The E2E uses a synthetic column and falls back to the opinion id when no catalog row exists.
CREATE TABLE IF NOT EXISTS opinioni_domande (
  id TEXT PRIMARY KEY,
  text TEXT NOT NULL,
  approfondimento TEXT,
  gradi_opinione TEXT[] DEFAULT ARRAY[]::TEXT[]
);

-- Legacy compatibility selectors still read by eventFeedService until their dedicated relational migration.
ALTER TABLE users ADD COLUMN IF NOT EXISTS attivisti TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS organizzazioni TEXT;

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

CREATE TABLE IF NOT EXISTS voti_iniziative_popolari (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  userid UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  iniziativa_id TEXT NOT NULL,
  timestamp TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (userid, iniziativa_id)
);

COMMIT;


CREATE TABLE IF NOT EXISTS parlamento_analisi_legge (
  id SERIAL PRIMARY KEY,
  uri_votazione TEXT NOT NULL UNIQUE,
  numero_legge TEXT,
  tipo_atto TEXT,
  spiegazione_generale TEXT,
  effetti_positivi TEXT,
  effetti_negativi TEXT,
  provider_ai VARCHAR(50),
  modello_ai VARCHAR(100),
  data_generazione TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  data_aggiornamento TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_parlamento_analisi_uri ON parlamento_analisi_legge(uri_votazione);
CREATE INDEX IF NOT EXISTS idx_parlamento_analisi_numero_legge ON parlamento_analisi_legge(numero_legge);
CREATE INDEX IF NOT EXISTS idx_parlamento_analisi_tipo_atto ON parlamento_analisi_legge(tipo_atto);
CREATE INDEX IF NOT EXISTS idx_parlamento_analisi_data_generazione ON parlamento_analisi_legge(data_generazione DESC);
