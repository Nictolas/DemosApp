-- Tabella per memorizzare le votazioni dei politici da Openpolis
-- Include sia deputati (C) che senatori (S)

CREATE TABLE IF NOT EXISTS voti_camera (
  -- ID primario
  id SERIAL PRIMARY KEY,
  
  -- Nome completo del politico (UNIQUE per evitare duplicati)
  politico_nome VARCHAR(255) NOT NULL UNIQUE,
  
  -- Camera o Senato
  camera VARCHAR(50) NOT NULL CHECK (camera IN ('Camera', 'Senato')),
  
  -- URL della pagina Openpolis (modificabile dall'admin)
  url_openpolis TEXT NOT NULL,
  
  -- Titolo/descrizione della votazione più recente
  votazione TEXT,
  
  -- Voto espresso: In missione, Astenuto, Favorevole, Contrario
  voto VARCHAR(50) CHECK (voto IN ('In missione', 'Astenuto', 'Favorevole', 'Contrario')),
  
  -- Data della votazione (se disponibile)
  data_votazione DATE,
  
  -- Data/ora dell'ultimo aggiornamento (per sovrascrivere)
  ultimo_aggiornamento TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Timestamp di creazione
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indici per migliorare le performance
CREATE INDEX IF NOT EXISTS idx_voti_camera_politico_nome ON voti_camera(politico_nome);
CREATE INDEX IF NOT EXISTS idx_voti_camera_camera ON voti_camera(camera);
CREATE INDEX IF NOT EXISTS idx_voti_camera_ultimo_aggiornamento ON voti_camera(ultimo_aggiornamento DESC);
CREATE INDEX IF NOT EXISTS idx_voti_camera_data_votazione ON voti_camera(data_votazione DESC);

-- Trigger per aggiornare automaticamente ultimo_aggiornamento
CREATE OR REPLACE FUNCTION update_voti_camera_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.ultimo_aggiornamento = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_voti_camera_updated_at
  BEFORE UPDATE ON voti_camera
  FOR EACH ROW
  EXECUTE FUNCTION update_voti_camera_updated_at();

-- Commenti per documentazione
COMMENT ON TABLE voti_camera IS 'Votazioni dei politici recuperate da Openpolis (deputati e senatori)';
COMMENT ON COLUMN voti_camera.politico_nome IS 'Nome completo del politico (UNIQUE)';
COMMENT ON COLUMN voti_camera.camera IS 'Camera o Senato in base a grado_elezione';
COMMENT ON COLUMN voti_camera.url_openpolis IS 'URL della pagina Openpolis del politico (modificabile dall''admin)';
COMMENT ON COLUMN voti_camera.votazione IS 'Titolo/descrizione della votazione più recente';
COMMENT ON COLUMN voti_camera.voto IS 'Voto espresso: In missione, Astenuto, Favorevole, Contrario';
COMMENT ON COLUMN voti_camera.ultimo_aggiornamento IS 'Data/ora dell''ultimo aggiornamento (per sovrascrivere i dati)';

