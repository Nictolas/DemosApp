-- Script per eliminare completamente la colonna firestore_uid_ref
-- dalla tabella voti_iniziative_popolari

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

