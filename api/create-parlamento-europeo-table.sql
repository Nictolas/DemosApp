-- Tabella per memorizzare le votazioni del Parlamento Europeo
-- Basata sui dati disponibili dall'API Open Data del PE
-- 
-- Dati disponibili:
-- - Sessioni plenarie (meetings) con date
-- - Votazioni (activities con tipo VOT) con risultati
-- - MEPs (membri del Parlamento Europeo)

CREATE TABLE IF NOT EXISTS parlamento_europeo (
  -- ID primario
  id SERIAL PRIMARY KEY,
  
  -- Identificatori
  uri TEXT NOT NULL UNIQUE, -- ID completo dalla API (es. "eli/dl/event/MTG-PL-2025-05-05-VOT-ITM-000001")
  votazione_id TEXT, -- Estratto dall'URI (ultima parte)
  
  -- Informazioni base
  titolo TEXT NOT NULL, -- Titolo/descrizione della votazione
  descrizione TEXT, -- Descrizione più dettagliata se disponibile
  
  -- Data della votazione (dalla sessione plenaria)
  data_votazione DATE,
  
  -- Esito
  esito VARCHAR(50), -- 'Approvato' o 'Non Approvato'
  
  -- Informazioni sessione plenaria
  sessione_id TEXT, -- ID della sessione plenaria (es. "MTG-PL-2025-05-05")
  sessione_data DATE, -- Data della sessione
  sessione_label TEXT, -- Label della sessione (multilingue, salveremo IT)
  
  -- Statistiche votazione
  favorevoli INTEGER, -- Numero voti favorevoli
  contrari INTEGER, -- Numero voti contrari
  astenuti INTEGER, -- Numero astenuti
  presenti INTEGER, -- Numero presenti
  votanti INTEGER, -- Numero votanti totali
  
  -- Legislatura/Termine parlamentare
  termine_parlamentare TEXT, -- Termine parlamentare (es. "org/ep-10")
  
  -- Metadati aggiuntivi in formato JSONB
  -- Contiene tutti i dati extra che potrebbero essere utili
  metadati JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamp
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  data_sincronizzazione TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indici per migliorare le performance
CREATE INDEX IF NOT EXISTS idx_parlamento_europeo_uri ON parlamento_europeo(uri);
CREATE INDEX IF NOT EXISTS idx_parlamento_europeo_data_votazione ON parlamento_europeo(data_votazione DESC);
CREATE INDEX IF NOT EXISTS idx_parlamento_europeo_esito ON parlamento_europeo(esito);
CREATE INDEX IF NOT EXISTS idx_parlamento_europeo_sessione_id ON parlamento_europeo(sessione_id);
CREATE INDEX IF NOT EXISTS idx_parlamento_europeo_data_sincronizzazione ON parlamento_europeo(data_sincronizzazione DESC);
CREATE INDEX IF NOT EXISTS idx_parlamento_europeo_metadati_gin ON parlamento_europeo USING GIN (metadati);

-- Indice composito per query frequenti (ultime votazioni)
CREATE INDEX IF NOT EXISTS idx_parlamento_europeo_data ON parlamento_europeo(data_votazione DESC NULLS LAST);

-- Trigger per aggiornare automaticamente updated_at
CREATE OR REPLACE FUNCTION update_parlamento_europeo_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_parlamento_europeo_updated_at
  BEFORE UPDATE ON parlamento_europeo
  FOR EACH ROW
  EXECUTE FUNCTION update_parlamento_europeo_updated_at();

-- Commenti per documentazione
COMMENT ON TABLE parlamento_europeo IS 'Votazioni del Parlamento Europeo recuperate dall''API Open Data';
COMMENT ON COLUMN parlamento_europeo.uri IS 'URI completo della votazione (identificatore univoco dall''API)';
COMMENT ON COLUMN parlamento_europeo.titolo IS 'Titolo/descrizione della votazione';
COMMENT ON COLUMN parlamento_europeo.data_votazione IS 'Data della votazione';
COMMENT ON COLUMN parlamento_europeo.esito IS 'Esito: Approvato o Non Approvato';
COMMENT ON COLUMN parlamento_europeo.sessione_id IS 'ID della sessione plenaria';
COMMENT ON COLUMN parlamento_europeo.favorevoli IS 'Numero voti favorevoli';
COMMENT ON COLUMN parlamento_europeo.contrari IS 'Numero voti contrari';
COMMENT ON COLUMN parlamento_europeo.astenuti IS 'Numero astenuti';
