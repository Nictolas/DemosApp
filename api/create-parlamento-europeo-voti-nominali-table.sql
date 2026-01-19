-- Tabella per memorizzare i voti nominali dei MEP italiani nelle votazioni del PE
-- Questa tabella permette di cache i voti nominali recuperati dall'API del PE

CREATE TABLE IF NOT EXISTS parlamento_europeo_voti_nominali (
  id SERIAL PRIMARY KEY,
  uri_votazione TEXT NOT NULL,
  mep_id TEXT NOT NULL, -- ID del MEP dall'API PE (es. "person/257073")
  nome_mep TEXT NOT NULL,
  cognome_mep TEXT,
  nome_completo TEXT NOT NULL,
  paese VARCHAR(2) NOT NULL DEFAULT 'IT', -- Codice ISO paese (IT per Italia)
  gruppo_politico TEXT, -- Gruppo politico del MEP (es. "PPE", "S-D", ecc.)
  voto VARCHAR(20) NOT NULL CHECK (voto IN ('Favorevole', 'Contrario', 'Astenuto', 'Assente')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  data_sincronizzazione TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Vincolo univoco: un MEP può votare solo una volta per votazione
  UNIQUE(uri_votazione, mep_id)
);

-- Indici per migliorare le performance delle query
CREATE INDEX IF NOT EXISTS idx_pe_voti_nominali_uri_votazione 
  ON parlamento_europeo_voti_nominali(uri_votazione);

CREATE INDEX IF NOT EXISTS idx_pe_voti_nominali_mep_id 
  ON parlamento_europeo_voti_nominali(mep_id);

CREATE INDEX IF NOT EXISTS idx_pe_voti_nominali_paese 
  ON parlamento_europeo_voti_nominali(paese);

CREATE INDEX IF NOT EXISTS idx_pe_voti_nominali_voto 
  ON parlamento_europeo_voti_nominali(voto);

CREATE INDEX IF NOT EXISTS idx_pe_voti_nominali_uri_voto 
  ON parlamento_europeo_voti_nominali(uri_votazione, voto);

-- Indice composito per query frequenti (voti italiani per votazione)
CREATE INDEX IF NOT EXISTS idx_pe_voti_nominali_uri_paese_voto 
  ON parlamento_europeo_voti_nominali(uri_votazione, paese, voto);

-- Trigger per aggiornare updated_at automaticamente
CREATE OR REPLACE FUNCTION update_pe_voti_nominali_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_pe_voti_nominali_updated_at
  BEFORE UPDATE ON parlamento_europeo_voti_nominali
  FOR EACH ROW
  EXECUTE FUNCTION update_pe_voti_nominali_updated_at();

-- Commenti per documentazione
COMMENT ON TABLE parlamento_europeo_voti_nominali IS 'Voti nominali dei MEP italiani nelle votazioni del Parlamento Europeo';
COMMENT ON COLUMN parlamento_europeo_voti_nominali.uri_votazione IS 'URI completo della votazione (chiave esterna verso parlamento_europeo.uri)';
COMMENT ON COLUMN parlamento_europeo_voti_nominali.mep_id IS 'ID del MEP dall''API del PE (es. "person/257073")';
COMMENT ON COLUMN parlamento_europeo_voti_nominali.nome_completo IS 'Nome completo del MEP';
COMMENT ON COLUMN parlamento_europeo_voti_nominali.paese IS 'Codice ISO paese (IT per Italia)';
COMMENT ON COLUMN parlamento_europeo_voti_nominali.voto IS 'Tipo di voto: Favorevole, Contrario, Astenuto, o Assente';
