-- Tabella per memorizzare le notifiche dei voti dei rappresentanti Camera e Senato
-- Simile a notifiche_voti_comuni ma per voti parlamentari

CREATE TABLE IF NOT EXISTS notifiche_voti_parlamento (
  -- ID primario
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- ID del politico che ha votato (riferimento a users.id)
  id_utente UUID REFERENCES users(id) ON DELETE CASCADE,
  
  -- Nome completo del politico (per display)
  politico VARCHAR(255) NOT NULL,
  
  -- Camera o Senato
  camera VARCHAR(50) NOT NULL CHECK (camera IN ('Camera', 'Senato')),
  
  -- Titolo della votazione (es: "Articolo 5 - Votazione Articolo 5 DDL n. 1718")
  titolo TEXT NOT NULL,
  
  -- Testo descrittivo (opzionale)
  testo TEXT,
  
  -- Voto espresso: Favorevole, Contrario, Astenuto, In missione
  voto VARCHAR(50) NOT NULL CHECK (voto IN ('Favorevole', 'Contrario', 'Astenuto', 'In missione')),
  
  -- Data della votazione
  data DATE,
  
  -- Data/ora di creazione della notifica
  data_creazione TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Hash univoco per evitare duplicati (politico_nome + votazione + data_votazione)
  -- Permette di evitare notifiche duplicate per la stessa votazione
  votazione_hash VARCHAR(255) UNIQUE,
  
  -- Likes e dislikes (per interazione utenti)
  likes INTEGER DEFAULT 0,
  dislikes INTEGER DEFAULT 0
);

-- Indici per migliorare le performance
CREATE INDEX IF NOT EXISTS idx_notifiche_voti_parlamento_id_utente 
  ON notifiche_voti_parlamento(id_utente);

CREATE INDEX IF NOT EXISTS idx_notifiche_voti_parlamento_politico 
  ON notifiche_voti_parlamento(politico);

CREATE INDEX IF NOT EXISTS idx_notifiche_voti_parlamento_camera 
  ON notifiche_voti_parlamento(camera);

CREATE INDEX IF NOT EXISTS idx_notifiche_voti_parlamento_data_creazione 
  ON notifiche_voti_parlamento(data_creazione DESC);

CREATE INDEX IF NOT EXISTS idx_notifiche_voti_parlamento_data 
  ON notifiche_voti_parlamento(data DESC);

CREATE INDEX IF NOT EXISTS idx_notifiche_voti_parlamento_votazione_hash 
  ON notifiche_voti_parlamento(votazione_hash);

-- Indice composito per query frequenti (utenti con rappresentante_camera o rappresentante_senato)
CREATE INDEX IF NOT EXISTS idx_notifiche_voti_parlamento_camera_politico 
  ON notifiche_voti_parlamento(camera, politico);

-- Commenti per documentazione
COMMENT ON TABLE notifiche_voti_parlamento IS 'Notifiche per i voti dei rappresentanti Camera e Senato scelti dagli utenti';
COMMENT ON COLUMN notifiche_voti_parlamento.id_utente IS 'ID del politico che ha votato (riferimento a users.id)';
COMMENT ON COLUMN notifiche_voti_parlamento.politico IS 'Nome completo del politico (per display)';
COMMENT ON COLUMN notifiche_voti_parlamento.camera IS 'Camera o Senato';
COMMENT ON COLUMN notifiche_voti_parlamento.votazione_hash IS 'Hash univoco per evitare duplicati (politico_nome + votazione + data_votazione)';
COMMENT ON COLUMN notifiche_voti_parlamento.voto IS 'Voto espresso: Favorevole, Contrario, Astenuto, In missione';


