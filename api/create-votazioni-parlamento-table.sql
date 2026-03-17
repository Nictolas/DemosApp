-- Tabella per memorizzare le votazioni parlamentari (Camera e Senato)
-- Ogni votazione ha UNA sola spiegazione AI condivisa da tutti i politici che l'hanno votata

CREATE TABLE IF NOT EXISTS votazioni_parlamento (
  -- ID primario
  id SERIAL PRIMARY KEY,
  
  -- Titolo/descrizione della votazione (per identificazione univoca)
  titolo_votazione TEXT NOT NULL,
  
  -- Descrizione completa scrapata da Openpolis (per generare spiegazioni accurate)
  descrizione_votazione TEXT,
  
  -- Camera o Senato
  camera VARCHAR(50) NOT NULL CHECK (camera IN ('Camera', 'Senato')),
  
  -- Data della votazione (se disponibile)
  data_votazione DATE,
  
  -- Spiegazione AI generata (UNA per votazione, condivisa da tutti i politici)
  spiegazione TEXT,
  
  -- Hash univoco per identificare votazioni duplicate (basato su titolo + camera + data)
  votazione_hash VARCHAR(255) UNIQUE,
  
  -- Timestamp di creazione e aggiornamento
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indici per migliorare le performance
CREATE INDEX IF NOT EXISTS idx_votazioni_parlamento_titolo ON votazioni_parlamento(titolo_votazione);
CREATE INDEX IF NOT EXISTS idx_votazioni_parlamento_camera ON votazioni_parlamento(camera);
CREATE INDEX IF NOT EXISTS idx_votazioni_parlamento_data ON votazioni_parlamento(data_votazione DESC);
CREATE INDEX IF NOT EXISTS idx_votazioni_parlamento_hash ON votazioni_parlamento(votazione_hash);
CREATE INDEX IF NOT EXISTS idx_votazioni_parlamento_spiegazione ON votazioni_parlamento(spiegazione) WHERE spiegazione IS NOT NULL;

-- Trigger per aggiornare automaticamente updated_at
CREATE OR REPLACE FUNCTION update_votazioni_parlamento_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_votazioni_parlamento_updated_at
  BEFORE UPDATE ON votazioni_parlamento
  FOR EACH ROW
  EXECUTE FUNCTION update_votazioni_parlamento_updated_at();

-- Commenti per documentazione
COMMENT ON TABLE votazioni_parlamento IS 'Votazioni parlamentari (Camera e Senato) con spiegazioni AI condivise';
COMMENT ON COLUMN votazioni_parlamento.titolo_votazione IS 'Titolo/descrizione della votazione (per identificazione)';
COMMENT ON COLUMN votazioni_parlamento.descrizione_votazione IS 'Descrizione completa scrapata da Openpolis per generare spiegazioni accurate';
COMMENT ON COLUMN votazioni_parlamento.spiegazione IS 'Spiegazione AI generata (UNA per votazione, condivisa da tutti i politici)';
COMMENT ON COLUMN votazioni_parlamento.votazione_hash IS 'Hash univoco per identificare votazioni duplicate (titolo + camera + data)';
