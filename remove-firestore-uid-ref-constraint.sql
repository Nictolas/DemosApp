-- Script per eliminare completamente le colonne firestore_uid_ref e firestore_uid_backup
-- dalle tabelle voti_iniziative_popolari e voti_referendum_abrogativi

-- ===== VOTI_INIZIATIVE_POPOLARI =====
-- Prima verifica se la colonna esiste
SELECT 
    column_name, 
    is_nullable, 
    data_type
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'voti_iniziative_popolari' 
AND column_name = 'firestore_uid_ref';

-- Elimina la colonna firestore_uid_ref
ALTER TABLE voti_iniziative_popolari 
DROP COLUMN IF EXISTS firestore_uid_ref;

-- Verifica che la colonna sia stata eliminata
SELECT 
    column_name, 
    is_nullable, 
    data_type
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'voti_iniziative_popolari';

-- ===== VOTI_REFERENDUM_ABROGATIVI =====
-- Prima verifica se la colonna esiste
SELECT 
    column_name, 
    is_nullable, 
    data_type
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'voti_referendum_abrogativi' 
AND column_name = 'firestore_uid_backup';

-- Elimina la colonna firestore_uid_backup
ALTER TABLE voti_referendum_abrogativi 
DROP COLUMN IF EXISTS firestore_uid_backup;

-- Verifica che la colonna sia stata eliminata
SELECT 
    column_name, 
    is_nullable, 
    data_type
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'voti_referendum_abrogativi';

