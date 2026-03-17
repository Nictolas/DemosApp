-- ============================================================
-- Script per eliminare colonna "status" e aggiornare "stato"
-- ============================================================
-- Questo script:
-- 1. Elimina la colonna "status" da iniziative_popolari e referendum_abrogativi
-- 2. Aggiorna la colonna "stato" impostando 'conclusa' per tutte le righe
-- ============================================================

-- ============================================================
-- 1. AGGIORNA iniziative_popolari
-- ============================================================

-- Prima aggiorna tutte le righe a stato = 'conclusa'
UPDATE iniziative_popolari 
SET stato = 'conclusa'
WHERE stato IS NULL OR stato != 'conclusa';

-- Poi elimina la colonna status
ALTER TABLE iniziative_popolari 
DROP COLUMN IF EXISTS status;

-- ============================================================
-- 2. AGGIORNA referendum_abrogativi
-- ============================================================

-- Prima aggiorna tutte le righe a stato = 'conclusa'
UPDATE referendum_abrogativi 
SET stato = 'conclusa'
WHERE stato IS NULL OR stato != 'conclusa';

-- Poi elimina la colonna status
ALTER TABLE referendum_abrogativi 
DROP COLUMN IF EXISTS status;

-- ============================================================
-- 3. VERIFICA
-- ============================================================

-- Verifica che la colonna status sia stata eliminata
DO $$
DECLARE
  iniziative_popolari_has_status BOOLEAN;
  referendum_abrogativi_has_status BOOLEAN;
  iniziative_popolari_stato_count INTEGER;
  referendum_abrogativi_stato_count INTEGER;
BEGIN
  -- Controlla se la colonna status esiste ancora
  SELECT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'iniziative_popolari' 
      AND column_name = 'status'
  ) INTO iniziative_popolari_has_status;
  
  SELECT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'referendum_abrogativi' 
      AND column_name = 'status'
  ) INTO referendum_abrogativi_has_status;
  
  -- Conta le righe con stato = 'conclusa'
  SELECT COUNT(*) INTO iniziative_popolari_stato_count
  FROM iniziative_popolari
  WHERE stato = 'conclusa';
  
  SELECT COUNT(*) INTO referendum_abrogativi_stato_count
  FROM referendum_abrogativi
  WHERE stato = 'conclusa';
  
  -- Log dei risultati
  IF iniziative_popolari_has_status THEN
    RAISE WARNING '⚠️ La colonna "status" esiste ancora in iniziative_popolari';
  ELSE
    RAISE NOTICE '✅ Colonna "status" eliminata da iniziative_popolari';
  END IF;
  
  IF referendum_abrogativi_has_status THEN
    RAISE WARNING '⚠️ La colonna "status" esiste ancora in referendum_abrogativi';
  ELSE
    RAISE NOTICE '✅ Colonna "status" eliminata da referendum_abrogativi';
  END IF;
  
  RAISE NOTICE '✅ Righe con stato = ''conclusa'' in iniziative_popolari: %', iniziative_popolari_stato_count;
  RAISE NOTICE '✅ Righe con stato = ''conclusa'' in referendum_abrogativi: %', referendum_abrogativi_stato_count;
  
  IF NOT iniziative_popolari_has_status AND NOT referendum_abrogativi_has_status THEN
    RAISE NOTICE '✅ Operazione completata con successo!';
  END IF;
END $$;

-- ============================================================
-- FINE SCRIPT
-- ============================================================

