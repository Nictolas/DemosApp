-- ============================================
-- OTTIMIZZAZIONI DATABASE VOTI CAMERA (FIXED)
-- ============================================
-- Versione corretta senza errori IMMUTABLE
-- Esegui questi script DOPO aver verificato che la migrazione a votazioni_parlamento è completa

-- ============================================
-- 1. RIMUOVI COLONNE OBSOLETE DA voti_camera
-- ============================================
-- ATTENZIONE: Rimuovi solo dopo aver verificato che la migrazione è completa!

-- Verifica prima che tutti i record abbiano votazione_id
-- SELECT COUNT(*) FROM voti_camera WHERE votazione_id IS NULL AND votazione IS NOT NULL;

-- Rimuovi colonne obsolete (solo se la migrazione è completa)
ALTER TABLE voti_camera DROP COLUMN IF EXISTS votazione;
ALTER TABLE voti_camera DROP COLUMN IF EXISTS descrizione_votazione;
ALTER TABLE voti_camera DROP COLUMN IF EXISTS spiegazione;

-- ============================================
-- 2. AGGIUNGI INDICI MANCANTI (SENZA ERRORI)
-- ============================================

-- Indice composito per query frequenti in voti_camera
CREATE INDEX IF NOT EXISTS idx_voti_camera_votazione_id_data 
  ON voti_camera(votazione_id, data_votazione DESC) 
  WHERE votazione_id IS NOT NULL;

-- Indice per JOIN users-voti_camera (usato spesso)
CREATE INDEX IF NOT EXISTS idx_users_nome_cognome_politici 
  ON users(nome, cognome) 
  WHERE ruolo = 'P' AND (grado_elezione = 'C' OR grado_elezione = 'S');

-- Indice per notifiche_voti_parlamento (query frequenti)
CREATE INDEX IF NOT EXISTS idx_notifiche_voti_parlamento_id_utente_data 
  ON notifiche_voti_parlamento(id_utente, data_creazione DESC);

-- Indice per votazioni_parlamento (query con data)
CREATE INDEX IF NOT EXISTS idx_votazioni_parlamento_data_camera 
  ON votazioni_parlamento(data_votazione DESC, camera) 
  WHERE data_votazione IS NOT NULL;

-- ============================================
-- 3. OTTIMIZZAZIONI notifiche_voti_parlamento
-- ============================================

-- Aggiungi indice composito per query ottimizzate
CREATE INDEX IF NOT EXISTS idx_notifiche_voti_parlamento_utente_hash 
  ON notifiche_voti_parlamento(id_utente, votazione_hash);

-- ============================================
-- 4. AGGIUNGI METADATI A votazioni_parlamento (opzionale)
-- ============================================

ALTER TABLE votazioni_parlamento 
  ADD COLUMN IF NOT EXISTS url_votazione TEXT,
  ADD COLUMN IF NOT EXISTS numero_seduta INTEGER,
  ADD COLUMN IF NOT EXISTS tipo_atto VARCHAR(50),
  ADD COLUMN IF NOT EXISTS sigla_atto VARCHAR(20),
  ADD COLUMN IF NOT EXISTS numero_atto INTEGER;

-- Indici per i nuovi metadati
CREATE INDEX IF NOT EXISTS idx_votazioni_parlamento_tipo_atto 
  ON votazioni_parlamento(tipo_atto) 
  WHERE tipo_atto IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_votazioni_parlamento_numero_seduta 
  ON votazioni_parlamento(numero_seduta) 
  WHERE numero_seduta IS NOT NULL;
