-- Tabella per memorizzare le analisi AI delle leggi votate in Parlamento
-- Contiene: spiegazione generale, effetti positivi, effetti negativi

CREATE TABLE IF NOT EXISTS parlamento_analisi_legge (
  id SERIAL PRIMARY KEY,
  uri_votazione TEXT NOT NULL UNIQUE,
  numero_legge TEXT, -- Estratto dal titolo (es. "1718")
  tipo_atto TEXT, -- DDL, Mozione, Decreto, ecc.
  
  -- Contenuti generati dall'AI
  spiegazione_generale TEXT, -- Spiegazione dettagliata della legge (max 300 parole)
  effetti_positivi TEXT, -- Lista effetti positivi (formato markdown elenco puntato)
  effetti_negativi TEXT, -- Lista effetti negativi (formato markdown elenco puntato)
  
  -- Metadati generazione
  provider_ai VARCHAR(50), -- 'groq' o 'openai'
  modello_ai VARCHAR(100), -- Modello usato (es. 'llama-3.3-70b-versatile')
  data_generazione TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  data_aggiornamento TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Timestamp
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_parlamento_analisi_uri ON parlamento_analisi_legge(uri_votazione);
CREATE INDEX IF NOT EXISTS idx_parlamento_analisi_numero_legge ON parlamento_analisi_legge(numero_legge);
CREATE INDEX IF NOT EXISTS idx_parlamento_analisi_tipo_atto ON parlamento_analisi_legge(tipo_atto);
CREATE INDEX IF NOT EXISTS idx_parlamento_analisi_data_generazione ON parlamento_analisi_legge(data_generazione DESC);

-- Commenti per documentazione
COMMENT ON TABLE parlamento_analisi_legge IS 'Analisi AI delle leggi votate in Parlamento (spiegazione, effetti positivi, effetti negativi)';
COMMENT ON COLUMN parlamento_analisi_legge.uri_votazione IS 'URI della votazione (FK verso parlamento.uri)';
COMMENT ON COLUMN parlamento_analisi_legge.numero_legge IS 'Numero della legge estratto dal titolo (es. "1718")';
COMMENT ON COLUMN parlamento_analisi_legge.spiegazione_generale IS 'Spiegazione dettagliata della legge generata dall''AI';
COMMENT ON COLUMN parlamento_analisi_legge.effetti_positivi IS 'Lista effetti positivi in formato markdown elenco puntato';
COMMENT ON COLUMN parlamento_analisi_legge.effetti_negativi IS 'Lista effetti negativi in formato markdown elenco puntato';
