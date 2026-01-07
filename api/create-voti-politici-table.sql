-- Tabella per memorizzare le votazioni della Camera dei Deputati
-- Recuperate dall'endpoint SPARQL http://dati.camera.it/sparql

-- Crea la tabella voti_politici
CREATE TABLE IF NOT EXISTS voti_politici (
  -- ID primario
  id SERIAL PRIMARY KEY,
  
  -- URI completo della votazione (identificatore univoco da SPARQL)
  uri TEXT NOT NULL UNIQUE,
  
  -- ID estratto dall'URI (ultima parte)
  votazione_id TEXT NOT NULL,
  
  -- Legislatura (es. 19 per XIX legislatura)
  legislatura INTEGER,
  
  -- Data della votazione
  data_votazione DATE,
  
  -- Descrizione/testo della votazione
  descrizione TEXT,
  
  -- Esito della votazione
  esito TEXT,
  
  -- Informazioni sull'atto
  sigla_atto TEXT,
  numero_atto TEXT,
  tipo_atto TEXT,
  
  -- Metadati aggiuntivi in formato JSONB (per tutti i predicati dinamici)
  -- Esempio: { "rif_legislatura": "...", "rif_seduta": "...", etc. }
  metadati JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamp di sincronizzazione
  data_sincronizzazione TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Timestamp di aggiornamento
  data_aggiornamento TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Indice per ricerca rapida
  CONSTRAINT voti_politici_uri_unique UNIQUE (uri)
);

-- Indici per migliorare le performance delle query
CREATE INDEX IF NOT EXISTS idx_voti_politici_votazione_id ON voti_politici(votazione_id);
CREATE INDEX IF NOT EXISTS idx_voti_politici_legislatura ON voti_politici(legislatura);
CREATE INDEX IF NOT EXISTS idx_voti_politici_data_votazione ON voti_politici(data_votazione DESC);
CREATE INDEX IF NOT EXISTS idx_voti_politici_esito ON voti_politici(esito);
CREATE INDEX IF NOT EXISTS idx_voti_politici_sigla_atto ON voti_politici(sigla_atto);
CREATE INDEX IF NOT EXISTS idx_voti_politici_data_sincronizzazione ON voti_politici(data_sincronizzazione DESC);

-- Indice GIN per ricerca nei metadati JSONB
CREATE INDEX IF NOT EXISTS idx_voti_politici_metadati_gin ON voti_politici USING GIN (metadati);

-- Trigger per aggiornare automaticamente data_aggiornamento
CREATE OR REPLACE FUNCTION update_voti_politici_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.data_aggiornamento = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_voti_politici_updated_at
  BEFORE UPDATE ON voti_politici
  FOR EACH ROW
  EXECUTE FUNCTION update_voti_politici_updated_at();

-- Commenti per documentazione
COMMENT ON TABLE voti_politici IS 'Votazioni della Camera dei Deputati recuperate dall''endpoint SPARQL';
COMMENT ON COLUMN voti_politici.uri IS 'URI completo della votazione (identificatore univoco da SPARQL)';
COMMENT ON COLUMN voti_politici.votazione_id IS 'ID estratto dall''URI (ultima parte)';
COMMENT ON COLUMN voti_politici.legislatura IS 'Numero della legislatura (es. 19 per XIX legislatura)';
COMMENT ON COLUMN voti_politici.metadati IS 'Metadati aggiuntivi in formato JSONB (tutti i predicati dinamici da SPARQL)';
COMMENT ON COLUMN voti_politici.data_sincronizzazione IS 'Data/ora in cui il record è stato sincronizzato da SPARQL';
COMMENT ON COLUMN voti_politici.data_aggiornamento IS 'Data/ora dell''ultimo aggiornamento del record';

