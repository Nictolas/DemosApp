-- Script per aggiungere il campo data_creazione alla tabella notifiche_voti_comuni
-- Questo campo permetterà di calcolare correttamente il tempo trascorso dalla creazione della notifica

-- Aggiungi la colonna data_creazione se non esiste già
DO $$ 
BEGIN
    -- Verifica se la colonna esiste già
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'notifiche_voti_comuni' 
        AND column_name = 'data_creazione'
    ) THEN
        -- Aggiungi la colonna data_creazione
        ALTER TABLE notifiche_voti_comuni 
        ADD COLUMN data_creazione TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
        
        -- Aggiorna le righe esistenti con data_creazione basata sul campo data
        -- Se data è NULL, usa CURRENT_TIMESTAMP
        UPDATE notifiche_voti_comuni 
        SET data_creazione = COALESCE(
            (data::timestamp with time zone + interval '12 hours'), -- Usa mezzogiorno del giorno come default
            CURRENT_TIMESTAMP
        )
        WHERE data_creazione IS NULL;
        
        RAISE NOTICE 'Colonna data_creazione aggiunta alla tabella notifiche_voti_comuni';
    ELSE
        RAISE NOTICE 'Colonna data_creazione già esistente nella tabella notifiche_voti_comuni';
    END IF;
END $$;

-- Verifica che la colonna sia stata aggiunta correttamente
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns
WHERE table_name = 'notifiche_voti_comuni' 
AND column_name = 'data_creazione';

