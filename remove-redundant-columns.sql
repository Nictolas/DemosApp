-- Script per eliminare le colonne ridondanti dalle tabelle iniziative_popolari e referendum_abrogativi
-- Eseguito: 2025-10-29

-- Tabella iniziative_popolari
ALTER TABLE iniziative_popolari 
  DROP COLUMN IF EXISTS firestoreid,
  DROP COLUMN IF EXISTS firestore_uid_backup,
  DROP COLUMN IF EXISTS datainizio,
  DROP COLUMN IF EXISTS datafine,
  DROP COLUMN IF EXISTS data_creazione;

-- Tabella referendum_abrogativi
ALTER TABLE referendum_abrogativi 
  DROP COLUMN IF EXISTS firestoreid,
  DROP COLUMN IF EXISTS firestore_uid_backup,
  DROP COLUMN IF EXISTS datainizio,
  DROP COLUMN IF EXISTS datafine,
  DROP COLUMN IF EXISTS data_creazione;

-- Verifica che le colonne siano state eliminate
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name IN ('iniziative_popolari', 'referendum_abrogativi')
ORDER BY table_name, ordinal_position;

