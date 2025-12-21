-- Script per rimuovere la colonna "comune_residenza" dalla tabella "notifiche_demos"

DO $$ 
BEGIN
    -- Rimuovi colonna "comune_residenza" se esiste
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notifiche_demos' AND column_name = 'comune_residenza'
    ) THEN
        ALTER TABLE notifiche_demos DROP COLUMN comune_residenza;
        RAISE NOTICE 'Colonna "comune_residenza" rimossa da notifiche_demos';
    ELSE
        RAISE NOTICE 'Colonna "comune_residenza" non trovata in notifiche_demos, saltata';
    END IF;
END $$;

-- Verifica finale struttura tabella
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'notifiche_demos'
ORDER BY ordinal_position;

