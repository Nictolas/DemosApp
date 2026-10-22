-- Tabella completa per memorizzare le votazioni parlamentari (Camera e Senato)
-- Basata sui dati REALMENTE disponibili dagli endpoint SPARQL ufficiali
-- 
-- Dati disponibili:
-- CAMERA: URI, label, approvato (1/0), seduta (con date YYYYMMDD, identifier, title)
-- SENATO: URI, label, favorevoli, contrari, presenti, votanti, maggioranza, tipoVotazione, seduta (con dataSeduta YYYY-MM-DD, numeroSeduta, legislatura)

CREATE TABLE IF NOT EXISTS parlamento (
  -- ID primario
  id SERIAL PRIMARY KEY,
  
  -- Identificatori
  uri TEXT NOT NULL UNIQUE,
  votazione_id TEXT, -- Estratto dall'URI (ultima parte)
  
  -- Camera o Senato
  camera VARCHAR(50) NOT NULL CHECK (camera IN ('Camera', 'Senato')),
  
  -- Informazioni base (disponibili in entrambe)
  titolo TEXT NOT NULL, -- Da rdfs:label
  descrizione TEXT, -- Stesso di titolo o più dettagliato se disponibile
  
  -- Data della votazione (dalla seduta)
  data_votazione DATE,
  
  -- Esito
  esito VARCHAR(50), -- 'Approvato' o 'Non Approvato'
  
  -- Informazioni seduta
  uri_seduta TEXT, -- URI della seduta
  numero_seduta TEXT, -- Numero/identifier della seduta
  titolo_seduta TEXT, -- Titolo della seduta (Camera: "Seduta di mercoledì 7 giugno 2023")
  
  -- Legislatura
  legislatura INTEGER, -- Numero legislatura (es. 19)
  
  -- Dati specifici SENATO (NULL per Camera)
  favorevoli INTEGER, -- Numero voti favorevoli (solo Senato)
  contrari INTEGER, -- Numero voti contrari (solo Senato)
  presenti INTEGER, -- Numero presenti (solo Senato)
  votanti INTEGER, -- Numero votanti (solo Senato)
  maggioranza INTEGER, -- Maggioranza richiesta (solo Senato)
  tipo_votazione TEXT, -- Tipo votazione (es. "elettronica") (solo Senato)
  
  -- Dati specifici CAMERA (NULL per Senato)
  approvato INTEGER, -- 1 = Approvato, 0 = Non Approvato (solo Camera)
  
  -- Metadati aggiuntivi in formato JSONB
  -- Contiene tutti i dati extra che potrebbero essere utili
  metadati JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamp
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  data_sincronizzazione TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indici per migliorare le performance
CREATE INDEX IF NOT EXISTS idx_parlamento_uri ON parlamento(uri);
CREATE INDEX IF NOT EXISTS idx_parlamento_camera ON parlamento(camera);
CREATE INDEX IF NOT EXISTS idx_parlamento_data_votazione ON parlamento(data_votazione DESC);
CREATE INDEX IF NOT EXISTS idx_parlamento_esito ON parlamento(esito);
CREATE INDEX IF NOT EXISTS idx_parlamento_legislatura ON parlamento(legislatura);
CREATE INDEX IF NOT EXISTS idx_parlamento_numero_seduta ON parlamento(numero_seduta);
CREATE INDEX IF NOT EXISTS idx_parlamento_data_sincronizzazione ON parlamento(data_sincronizzazione DESC);
CREATE INDEX IF NOT EXISTS idx_parlamento_metadati_gin ON parlamento USING GIN (metadati);

-- Indice composito per query frequenti (ultime votazioni per camera)
CREATE INDEX IF NOT EXISTS idx_parlamento_camera_data ON parlamento(camera, data_votazione DESC NULLS LAST);

-- Trigger per aggiornare automaticamente updated_at
CREATE OR REPLACE FUNCTION update_parlamento_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';

CREATE TRIGGER trigger_update_parlamento_updated_at
  BEFORE UPDATE ON parlamento
  FOR EACH ROW
  EXECUTE FUNCTION update_parlamento_updated_at();

-- Commenti per documentazione
COMMENT ON TABLE parlamento IS 'Votazioni parlamentari (Camera e Senato) recuperate dagli endpoint SPARQL ufficiali';
COMMENT ON COLUMN parlamento.uri IS 'URI completo della votazione (identificatore univoco da SPARQL)';
COMMENT ON COLUMN parlamento.camera IS 'Camera dei Deputati o Senato della Repubblica';
COMMENT ON COLUMN parlamento.titolo IS 'Titolo/descrizione della votazione (da rdfs:label)';
COMMENT ON COLUMN parlamento.data_votazione IS 'Data della votazione (recuperata dalla seduta)';
COMMENT ON COLUMN parlamento.esito IS 'Esito: Approvato o Non Approvato';
COMMENT ON COLUMN parlamento.favorevoli IS 'Numero voti favorevoli (solo Senato)';
COMMENT ON COLUMN parlamento.contrari IS 'Numero voti contrari (solo Senato)';
COMMENT ON COLUMN parlamento.presenti IS 'Numero presenti (solo Senato)';
COMMENT ON COLUMN parlamento.votanti IS 'Numero votanti (solo Senato)';
COMMENT ON COLUMN parlamento.maggioranza IS 'Maggioranza richiesta (solo Senato)';
COMMENT ON COLUMN parlamento.tipo_votazione IS 'Tipo votazione (es. elettronica) (solo Senato)';
COMMENT ON COLUMN parlamento.approvato IS '1 = Approvato, 0 = Non Approvato (solo Camera)';
COMMENT ON COLUMN parlamento.metadati IS 'Metadati aggiuntivi in formato JSONB';
