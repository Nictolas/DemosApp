-- Tabella per memorizzare i voti nominali delle votazioni parlamentari
-- Questa tabella permette di cache i voti nominali recuperati da SPARQL
-- per migliorare le performance e ridurre le chiamate agli endpoint SPARQL

CREATE TABLE IF NOT EXISTS parlamento_voti_nominali (
  id SERIAL PRIMARY KEY,
  uri_votazione TEXT NOT NULL,
  camera VARCHAR(50) NOT NULL CHECK (camera IN ('Camera', 'Senato')),
  nome_politico TEXT NOT NULL,
  voto VARCHAR(20) NOT NULL CHECK (voto IN ('Favorevole', 'Contrario', 'Astenuto')),
  uri_politico TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  data_sincronizzazione TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Vincolo univoco: un politico può votare solo una volta per votazione
  UNIQUE(uri_votazione, nome_politico, voto)
);

-- Indici per migliorare le performance delle query
CREATE INDEX IF NOT EXISTS idx_parlamento_voti_nominali_uri_votazione 
  ON parlamento_voti_nominali(uri_votazione);

CREATE INDEX IF NOT EXISTS idx_parlamento_voti_nominali_camera 
  ON parlamento_voti_nominali(camera);

CREATE INDEX IF NOT EXISTS idx_parlamento_voti_nominali_voto 
  ON parlamento_voti_nominali(voto);

CREATE INDEX IF NOT EXISTS idx_parlamento_voti_nominali_nome_politico 
  ON parlamento_voti_nominali(nome_politico);

CREATE INDEX IF NOT EXISTS idx_parlamento_voti_nominali_uri_votazione_voto 
  ON parlamento_voti_nominali(uri_votazione, voto);

-- Indice composito per query frequenti
CREATE INDEX IF NOT EXISTS idx_parlamento_voti_nominali_uri_voto 
  ON parlamento_voti_nominali(uri_votazione, voto, camera);

-- Trigger per aggiornare updated_at automaticamente
CREATE OR REPLACE FUNCTION update_parlamento_voti_nominali_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_parlamento_voti_nominali_updated_at
  BEFORE UPDATE ON parlamento_voti_nominali
  FOR EACH ROW
  EXECUTE FUNCTION update_parlamento_voti_nominali_updated_at();

-- Commenti per documentazione
COMMENT ON TABLE parlamento_voti_nominali IS 'Voti nominali delle votazioni parlamentari (Camera e Senato) recuperati da SPARQL';
COMMENT ON COLUMN parlamento_voti_nominali.uri_votazione IS 'URI completo della votazione (chiave esterna verso parlamento.uri)';
COMMENT ON COLUMN parlamento_voti_nominali.camera IS 'Camera dei Deputati o Senato della Repubblica';
COMMENT ON COLUMN parlamento_voti_nominali.nome_politico IS 'Nome completo del politico (da rdfs:label)';
COMMENT ON COLUMN parlamento_voti_nominali.voto IS 'Tipo di voto: Favorevole, Contrario, o Astenuto';
COMMENT ON COLUMN parlamento_voti_nominali.uri_politico IS 'URI del politico da SPARQL (opzionale, per riferimento futuro)';
COMMENT ON COLUMN parlamento_voti_nominali.data_sincronizzazione IS 'Data/ora dell''ultima sincronizzazione da SPARQL';

-- Query di esempio per verificare la struttura
-- SELECT 
--   uri_votazione,
--   camera,
--   voto,
--   COUNT(*) as numero_voti
-- FROM parlamento_voti_nominali
-- GROUP BY uri_votazione, camera, voto
-- ORDER BY uri_votazione, voto;
