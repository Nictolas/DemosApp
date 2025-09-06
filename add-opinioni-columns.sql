-- Script per aggiungere le colonne mancanti alla tabella opinioni
-- Eseguire questo script sul database di produzione

-- Controlla se la colonna approfondimento esiste
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'opinioni' 
        AND column_name = 'approfondimento'
    ) THEN
        ALTER TABLE opinioni ADD COLUMN approfondimento TEXT;
        RAISE NOTICE 'Colonna approfondimento aggiunta';
    ELSE
        RAISE NOTICE 'Colonna approfondimento già esiste';
    END IF;
END $$;

-- Controlla se la colonna gradi_opinione esiste
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'opinioni' 
        AND column_name = 'gradi_opinione'
    ) THEN
        ALTER TABLE opinioni ADD COLUMN gradi_opinione TEXT[];
        RAISE NOTICE 'Colonna gradi_opinione aggiunta';
    ELSE
        RAISE NOTICE 'Colonna gradi_opinione già esiste';
    END IF;
END $$;

-- Controlla se la colonna updated_at esiste
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'opinioni' 
        AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE opinioni ADD COLUMN updated_at TIMESTAMP DEFAULT NOW();
        RAISE NOTICE 'Colonna updated_at aggiunta';
    ELSE
        RAISE NOTICE 'Colonna updated_at già esiste';
    END IF;
END $$;

-- Verifica la struttura finale della tabella
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'opinioni'
ORDER BY ordinal_position;
