-- Script per aggiungere colonna preferenze_notifiche se non esiste
-- Verifica e aggiunge la colonna preferenze_notifiche (o notifiche_preferenze) alla tabella users

-- Prima verifica se esiste già una delle due colonne
DO $$
BEGIN
    -- Controlla se esiste preferenze_notifiche
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'preferenze_notifiche'
    ) THEN
        -- Controlla se esiste notifiche_preferenze
        IF EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_name = 'users' 
            AND column_name = 'notifiche_preferenze'
        ) THEN
            -- Se esiste notifiche_preferenze, la rinomina in preferenze_notifiche per coerenza
            ALTER TABLE users RENAME COLUMN notifiche_preferenze TO preferenze_notifiche;
            RAISE NOTICE 'Colonna notifiche_preferenze rinominata in preferenze_notifiche';
        ELSE
            -- Se non esiste nessuna delle due, crea preferenze_notifiche
            ALTER TABLE users ADD COLUMN preferenze_notifiche JSONB DEFAULT '{}'::jsonb;
            RAISE NOTICE 'Colonna preferenze_notifiche creata';
        END IF;
    ELSE
        RAISE NOTICE 'Colonna preferenze_notifiche già esistente';
    END IF;
    
    -- Verifica se esiste fcm_tokens
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'fcm_tokens'
    ) THEN
        ALTER TABLE users ADD COLUMN fcm_tokens TEXT[];
        RAISE NOTICE 'Colonna fcm_tokens creata';
    ELSE
        RAISE NOTICE 'Colonna fcm_tokens già esistente';
    END IF;
END $$;

-- Verifica finale
SELECT 
    column_name, 
    data_type, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name IN ('preferenze_notifiche', 'notifiche_preferenze', 'fcm_tokens')
ORDER BY column_name;






