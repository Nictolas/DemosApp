-- ============================================================
-- Script di allineamento tabelle legacy a iniziative_ministero
-- ============================================================
-- Questo script aggiunge colonne standardizzate alle tabelle legacy
-- mantenendo le colonne vecchie per retrocompatibilità
-- ============================================================

-- ============================================================
-- 1. ALLINEAMENTO iniziative_popolari
-- ============================================================

-- Aggiungi colonne standardizzate (se non esistono)
ALTER TABLE iniziative_popolari 
ADD COLUMN IF NOT EXISTS titolo TEXT,
ADD COLUMN IF NOT EXISTS stato VARCHAR(50) DEFAULT 'in_corso',
ADD COLUMN IF NOT EXISTS quorum_raggiunto BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS firme_raccolte INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS esito VARCHAR(100),
ADD COLUMN IF NOT EXISTS tipo VARCHAR(50) DEFAULT 'iniziativa',
ADD COLUMN IF NOT EXISTS data_ultimo_aggiornamento TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Migra i dati dalle colonne vecchie alle nuove
-- titolo <- nome
UPDATE iniziative_popolari 
SET titolo = nome 
WHERE titolo IS NULL AND nome IS NOT NULL;

-- stato <- status (mappa i valori)
-- Aggiorna solo le righe che non hanno ancora stato o hanno il default
UPDATE iniziative_popolari 
SET stato = CASE 
  WHEN status IS NULL OR status::text = '' THEN 'in_corso'
  WHEN LOWER(status::text) IN ('pending', 'in attesa', 'in_corso', 'in corso') THEN 'in_corso'
  WHEN LOWER(status::text) IN ('conclusa', 'concluso', 'completed') THEN 'conclusa'
  WHEN LOWER(status::text) IN ('approvata', 'approved', 'ok') THEN 'conclusa'
  WHEN LOWER(status::text) IN ('rifiutata', 'rejected', 'rifiutato') THEN 'conclusa'
  ELSE 'in_corso'
END
WHERE stato IS NULL;

-- quorum_raggiunto <- quorum
UPDATE iniziative_popolari 
SET quorum_raggiunto = CASE 
  WHEN quorum::text = 'ok' OR quorum::text = 'OK' THEN true
  WHEN quorum::text = 'proposta' THEN false
  WHEN quorum IS NOT NULL AND quorum::text ~ '^[0-9]+$' AND (quorum::text)::integer > 0 THEN true
  ELSE false
END
WHERE quorum_raggiunto IS NULL;

-- firme_raccolte <- firme
UPDATE iniziative_popolari 
SET firme_raccolte = COALESCE(firme, 0)
WHERE firme_raccolte IS NULL OR firme_raccolte = 0;

-- esito <- status/quorum (mappa i valori)
UPDATE iniziative_popolari 
SET esito = CASE 
  WHEN quorum::text = 'ok' OR quorum::text = 'OK' THEN 'Approvata'
  WHEN status IS NOT NULL AND LOWER(status::text) IN ('approvata', 'approved') THEN 'Approvata'
  WHEN status IS NOT NULL AND LOWER(status::text) IN ('rifiutata', 'rejected') THEN 'Rifiutata'
  WHEN status IS NOT NULL AND LOWER(status::text) IN ('conclusa', 'concluso', 'completed') THEN 'Conclusa'
  ELSE 'In Attesa'
END
WHERE esito IS NULL;

-- Assicurati che id sia VARCHAR(255) se non lo è già
-- (PostgreSQL non supporta ALTER COLUMN TYPE se ci sono dati, quindi solo se vuoto)
-- In questo caso, assumiamo che id sia già VARCHAR o UUID, quindi lo lasciamo così

-- Crea indici per le nuove colonne
CREATE INDEX IF NOT EXISTS idx_iniziative_popolari_titolo ON iniziative_popolari(titolo);
CREATE INDEX IF NOT EXISTS idx_iniziative_popolari_stato ON iniziative_popolari(stato);
CREATE INDEX IF NOT EXISTS idx_iniziative_popolari_quorum_raggiunto ON iniziative_popolari(quorum_raggiunto);
CREATE INDEX IF NOT EXISTS idx_iniziative_popolari_esito ON iniziative_popolari(esito);
CREATE INDEX IF NOT EXISTS idx_iniziative_popolari_tipo ON iniziative_popolari(tipo);

-- ============================================================
-- 2. ALLINEAMENTO referendum_abrogativi
-- ============================================================

-- Aggiungi colonne standardizzate (se non esistono)
ALTER TABLE referendum_abrogativi 
ADD COLUMN IF NOT EXISTS titolo TEXT,
ADD COLUMN IF NOT EXISTS stato VARCHAR(50) DEFAULT 'in_corso',
ADD COLUMN IF NOT EXISTS quorum_raggiunto BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS firme_raccolte INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS esito VARCHAR(100),
ADD COLUMN IF NOT EXISTS tipo VARCHAR(50) DEFAULT 'referendum',
ADD COLUMN IF NOT EXISTS data_ultimo_aggiornamento TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Migra i dati dalle colonne vecchie alle nuove
-- titolo <- nome
UPDATE referendum_abrogativi 
SET titolo = nome 
WHERE titolo IS NULL AND nome IS NOT NULL;

-- stato <- status (mappa 'A'/'a' = conclusa, 'P'/'p' = in_corso)
-- Aggiorna solo le righe che non hanno ancora stato
UPDATE referendum_abrogativi 
SET stato = CASE 
  WHEN status IS NULL OR status::text = '' THEN 'in_corso'
  WHEN UPPER(status::text) = 'A' THEN 'conclusa'
  WHEN UPPER(status::text) = 'P' THEN 'in_corso'
  WHEN LOWER(status::text) IN ('pending', 'in attesa', 'in_corso', 'in corso') THEN 'in_corso'
  WHEN LOWER(status::text) IN ('conclusa', 'concluso', 'completed', 'approved') THEN 'conclusa'
  ELSE 'in_corso'
END
WHERE stato IS NULL;

-- quorum_raggiunto <- status (se 'A' o 'a' = true)
UPDATE referendum_abrogativi 
SET quorum_raggiunto = CASE 
  WHEN UPPER(status::text) = 'A' THEN true
  WHEN quorum::text = 'ok' OR quorum::text = 'OK' THEN true
  WHEN quorum IS NOT NULL AND quorum::text ~ '^[0-9]+$' AND (quorum::text)::integer > 0 THEN true
  ELSE false
END
WHERE quorum_raggiunto IS NULL;

-- firme_raccolte <- firme
UPDATE referendum_abrogativi 
SET firme_raccolte = COALESCE(firme, 0)
WHERE firme_raccolte IS NULL OR firme_raccolte = 0;

-- esito <- status (mappa i valori)
UPDATE referendum_abrogativi 
SET esito = CASE 
  WHEN status IS NOT NULL AND UPPER(status::text) = 'A' THEN 'Approvata'
  WHEN quorum::text = 'ok' OR quorum::text = 'OK' THEN 'Approvata'
  WHEN status IS NOT NULL AND LOWER(status::text) IN ('approvata', 'approved') THEN 'Approvata'
  WHEN status IS NOT NULL AND LOWER(status::text) IN ('rifiutata', 'rejected') THEN 'Rifiutata'
  WHEN status IS NOT NULL AND LOWER(status::text) IN ('conclusa', 'concluso', 'completed') THEN 'Conclusa'
  ELSE 'In Attesa'
END
WHERE esito IS NULL;

-- Crea indici per le nuove colonne
CREATE INDEX IF NOT EXISTS idx_referendum_abrogativi_titolo ON referendum_abrogativi(titolo);
CREATE INDEX IF NOT EXISTS idx_referendum_abrogativi_stato ON referendum_abrogativi(stato);
CREATE INDEX IF NOT EXISTS idx_referendum_abrogativi_quorum_raggiunto ON referendum_abrogativi(quorum_raggiunto);
CREATE INDEX IF NOT EXISTS idx_referendum_abrogativi_esito ON referendum_abrogativi(esito);
CREATE INDEX IF NOT EXISTS idx_referendum_abrogativi_tipo ON referendum_abrogativi(tipo);

-- ============================================================
-- 3. ALLINEAMENTO voti_iniziative_popolari
-- ============================================================

-- Assicurati che iniziativa_id sia TEXT/VARCHAR per compatibilità
-- (se è UUID, PostgreSQL lo gestirà automaticamente nelle conversioni)
-- Aggiungi un indice se non esiste
CREATE INDEX IF NOT EXISTS idx_voti_iniziative_popolari_iniziativa_id ON voti_iniziative_popolari(iniziativa_id);

-- Verifica che userid sia UUID (dovrebbe già esserlo)
-- Aggiungi un indice se non esiste
CREATE INDEX IF NOT EXISTS idx_voti_iniziative_popolari_userid ON voti_iniziative_popolari(userid);

-- ============================================================
-- 4. ALLINEAMENTO voti_referendum_abrogativi
-- ============================================================

-- Assicurati che referendum_id sia TEXT/VARCHAR per compatibilità
-- Aggiungi un indice se non esiste
CREATE INDEX IF NOT EXISTS idx_voti_referendum_abrogativi_referendum_id ON voti_referendum_abrogativi(referendum_id);

-- Verifica che userid sia UUID (dovrebbe già esserlo)
-- Aggiungi un indice se non esiste
CREATE INDEX IF NOT EXISTS idx_voti_referendum_abrogativi_userid ON voti_referendum_abrogativi(userid);

-- ============================================================
-- 5. TRIGGER per mantenere sincronizzate le colonne vecchie e nuove
-- ============================================================

-- Trigger per iniziative_popolari: aggiorna titolo quando nome cambia (e viceversa)
CREATE OR REPLACE FUNCTION sync_iniziative_popolari_nome_titolo()
RETURNS TRIGGER AS $$
BEGIN
  -- Se nome è stato modificato, aggiorna titolo
  IF NEW.nome IS NOT NULL AND (NEW.titolo IS NULL OR NEW.titolo != NEW.nome) THEN
    NEW.titolo = NEW.nome;
  END IF;
  -- Se titolo è stato modificato, aggiorna nome
  IF NEW.titolo IS NOT NULL AND (NEW.nome IS NULL OR NEW.nome != NEW.titolo) THEN
    NEW.nome = NEW.titolo;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_iniziative_popolari_nome_titolo ON iniziative_popolari;
CREATE TRIGGER trigger_sync_iniziative_popolari_nome_titolo
BEFORE INSERT OR UPDATE ON iniziative_popolari
FOR EACH ROW
EXECUTE FUNCTION sync_iniziative_popolari_nome_titolo();

-- Trigger per referendum_abrogativi: aggiorna titolo quando nome cambia (e viceversa)
CREATE OR REPLACE FUNCTION sync_referendum_abrogativi_nome_titolo()
RETURNS TRIGGER AS $$
BEGIN
  -- Se nome è stato modificato, aggiorna titolo
  IF NEW.nome IS NOT NULL AND (NEW.titolo IS NULL OR NEW.titolo != NEW.nome) THEN
    NEW.titolo = NEW.nome;
  END IF;
  -- Se titolo è stato modificato, aggiorna nome
  IF NEW.titolo IS NOT NULL AND (NEW.nome IS NULL OR NEW.nome != NEW.titolo) THEN
    NEW.nome = NEW.titolo;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_referendum_abrogativi_nome_titolo ON referendum_abrogativi;
CREATE TRIGGER trigger_sync_referendum_abrogativi_nome_titolo
BEFORE INSERT OR UPDATE ON referendum_abrogativi
FOR EACH ROW
EXECUTE FUNCTION sync_referendum_abrogativi_nome_titolo();

-- ============================================================
-- 6. COMMENTI per documentazione
-- ============================================================

COMMENT ON COLUMN iniziative_popolari.titolo IS 'Titolo dell''iniziativa (alias di nome per compatibilità con iniziative_ministero)';
COMMENT ON COLUMN iniziative_popolari.stato IS 'Stato della raccolta firme (in_corso, conclusa, etc.) - standardizzato da status';
COMMENT ON COLUMN iniziative_popolari.quorum_raggiunto IS 'Indica se il quorum è stato raggiunto - standardizzato da quorum';
COMMENT ON COLUMN iniziative_popolari.firme_raccolte IS 'Numero di firme raccolte - standardizzato da firme';
COMMENT ON COLUMN iniziative_popolari.esito IS 'Esito dell''iniziativa DOPO la conclusione (Approvata, Rifiutata, etc.)';
COMMENT ON COLUMN iniziative_popolari.tipo IS 'Tipo: iniziativa (per compatibilità con iniziative_ministero)';

COMMENT ON COLUMN referendum_abrogativi.titolo IS 'Titolo del referendum (alias di nome per compatibilità con iniziative_ministero)';
COMMENT ON COLUMN referendum_abrogativi.stato IS 'Stato della raccolta firme (in_corso, conclusa, etc.) - standardizzato da status';
COMMENT ON COLUMN referendum_abrogativi.quorum_raggiunto IS 'Indica se il quorum è stato raggiunto - standardizzato da status/quorum';
COMMENT ON COLUMN referendum_abrogativi.firme_raccolte IS 'Numero di firme raccolte - standardizzato da firme';
COMMENT ON COLUMN referendum_abrogativi.esito IS 'Esito del referendum DOPO la conclusione (Approvata, Rifiutata, etc.)';
COMMENT ON COLUMN referendum_abrogativi.tipo IS 'Tipo: referendum (per compatibilità con iniziative_ministero)';

-- ============================================================
-- 7. VERIFICA FINALE
-- ============================================================

-- Query di verifica per controllare che le colonne siano state aggiunte correttamente
DO $$
DECLARE
  iniziative_popolari_cols INTEGER;
  referendum_abrogativi_cols INTEGER;
BEGIN
  -- Conta le colonne standardizzate in iniziative_popolari
  SELECT COUNT(*) INTO iniziative_popolari_cols
  FROM information_schema.columns
  WHERE table_name = 'iniziative_popolari'
    AND column_name IN ('titolo', 'stato', 'quorum_raggiunto', 'firme_raccolte', 'esito', 'tipo', 'data_ultimo_aggiornamento');
  
  -- Conta le colonne standardizzate in referendum_abrogativi
  SELECT COUNT(*) INTO referendum_abrogativi_cols
  FROM information_schema.columns
  WHERE table_name = 'referendum_abrogativi'
    AND column_name IN ('titolo', 'stato', 'quorum_raggiunto', 'firme_raccolte', 'esito', 'tipo', 'data_ultimo_aggiornamento');
  
  -- Log dei risultati
  RAISE NOTICE '✅ Colonne standardizzate in iniziative_popolari: %/7', iniziative_popolari_cols;
  RAISE NOTICE '✅ Colonne standardizzate in referendum_abrogativi: %/7', referendum_abrogativi_cols;
  
  IF iniziative_popolari_cols = 7 AND referendum_abrogativi_cols = 7 THEN
    RAISE NOTICE '✅ Allineamento completato con successo!';
  ELSE
    RAISE WARNING '⚠️ Alcune colonne potrebbero non essere state aggiunte correttamente';
  END IF;
END $$;

-- ============================================================
-- FINE SCRIPT
-- ============================================================

