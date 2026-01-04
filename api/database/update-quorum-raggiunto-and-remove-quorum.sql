-- ============================================================
-- Script per aggiornare quorum_raggiunto e eliminare colonna quorum
-- ============================================================
-- Questo script:
-- 1. Imposta quorum_raggiunto = TRUE per tutte le righe in iniziative_popolari e referendum_abrogativi
-- 2. Elimina la colonna "quorum" da entrambe le tabelle
-- ============================================================

-- ============================================================
-- 1. AGGIORNA iniziative_popolari
-- ============================================================

-- Imposta quorum_raggiunto = TRUE per tutte le righe
UPDATE iniziative_popolari 
SET quorum_raggiunto = true
WHERE quorum_raggiunto IS NULL OR quorum_raggiunto = false;

-- Elimina la colonna quorum
ALTER TABLE iniziative_popolari 
DROP COLUMN IF EXISTS quorum;

-- ============================================================
-- 2. AGGIORNA referendum_abrogativi
-- ============================================================

-- Imposta quorum_raggiunto = TRUE per tutte le righe
UPDATE referendum_abrogativi 
SET quorum_raggiunto = true
WHERE quorum_raggiunto IS NULL OR quorum_raggiunto = false;

-- Elimina la colonna quorum
ALTER TABLE referendum_abrogativi 
DROP COLUMN IF EXISTS quorum;

-- ============================================================
-- 3. VERIFICA
-- ============================================================

-- Verifica che la colonna quorum sia stata eliminata e che quorum_raggiunto sia TRUE
DO $$
DECLARE
  iniziative_popolari_has_quorum BOOLEAN;
  referendum_abrogativi_has_quorum BOOLEAN;
  iniziative_popolari_quorum_raggiunto_count INTEGER;
  iniziative_popolari_total_count INTEGER;
  referendum_abrogativi_quorum_raggiunto_count INTEGER;
  referendum_abrogativi_total_count INTEGER;
BEGIN
  -- Controlla se la colonna quorum esiste ancora
  SELECT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'iniziative_popolari' 
      AND column_name = 'quorum'
  ) INTO iniziative_popolari_has_quorum;
  
  SELECT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'referendum_abrogativi' 
      AND column_name = 'quorum'
  ) INTO referendum_abrogativi_has_quorum;
  
  -- Conta le righe con quorum_raggiunto = TRUE e il totale
  SELECT COUNT(*) INTO iniziative_popolari_total_count
  FROM iniziative_popolari;
  
  SELECT COUNT(*) INTO iniziative_popolari_quorum_raggiunto_count
  FROM iniziative_popolari
  WHERE quorum_raggiunto = true;
  
  SELECT COUNT(*) INTO referendum_abrogativi_total_count
  FROM referendum_abrogativi;
  
  SELECT COUNT(*) INTO referendum_abrogativi_quorum_raggiunto_count
  FROM referendum_abrogativi
  WHERE quorum_raggiunto = true;
  
  -- Log dei risultati
  IF iniziative_popolari_has_quorum THEN
    RAISE WARNING '⚠️ La colonna "quorum" esiste ancora in iniziative_popolari';
  ELSE
    RAISE NOTICE '✅ Colonna "quorum" eliminata da iniziative_popolari';
  END IF;
  
  IF referendum_abrogativi_has_quorum THEN
    RAISE WARNING '⚠️ La colonna "quorum" esiste ancora in referendum_abrogativi';
  ELSE
    RAISE NOTICE '✅ Colonna "quorum" eliminata da referendum_abrogativi';
  END IF;
  
  RAISE NOTICE '✅ iniziative_popolari: %/% righe con quorum_raggiunto = TRUE', 
    iniziative_popolari_quorum_raggiunto_count, iniziative_popolari_total_count;
  RAISE NOTICE '✅ referendum_abrogativi: %/% righe con quorum_raggiunto = TRUE', 
    referendum_abrogativi_quorum_raggiunto_count, referendum_abrogativi_total_count;
  
  IF NOT iniziative_popolari_has_quorum 
     AND NOT referendum_abrogativi_has_quorum
     AND iniziative_popolari_quorum_raggiunto_count = iniziative_popolari_total_count
     AND referendum_abrogativi_quorum_raggiunto_count = referendum_abrogativi_total_count THEN
    RAISE NOTICE '✅ Operazione completata con successo!';
  ELSE
    RAISE WARNING '⚠️ Verifica i risultati: alcune righe potrebbero non essere state aggiornate';
  END IF;
END $$;

-- ============================================================
-- FINE SCRIPT
-- ============================================================

