-- Script per RIMPIAZZARE le colonne attivisti e organizzazioni con tipo UUID
-- Se le colonne esistono con tipo VARCHAR, le elimina e le ricrea come UUID

-- Elimina le colonne esistenti se sono del tipo sbagliato
DO $$ 
BEGIN
    -- Elimina colonna attivisti se esiste
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'attivisti'
    ) THEN
        ALTER TABLE users DROP COLUMN IF EXISTS attivisti CASCADE;
        RAISE NOTICE 'Colonna attivisti eliminata';
    END IF;
    
    -- Elimina colonna organizzazioni se esiste
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'organizzazioni'
    ) THEN
        ALTER TABLE users DROP COLUMN IF EXISTS organizzazioni CASCADE;
        RAISE NOTICE 'Colonna organizzazioni eliminata';
    END IF;
END $$;

-- Crea le colonne con tipo UUID corretto
ALTER TABLE users ADD COLUMN IF NOT EXISTS attivisti UUID DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS organizzazioni UUID DEFAULT NULL;

-- Crea gli indici
CREATE INDEX IF NOT EXISTS idx_users_attivisti ON users (attivisti);
CREATE INDEX IF NOT EXISTS idx_users_organizzazioni ON users (organizzazioni);

-- Verifica la struttura finale
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name IN ('attivisti', 'organizzazioni')
ORDER BY column_name;

