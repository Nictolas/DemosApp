-- Script SQL per aggiungere le colonne per il consenso alle opinioni politiche
-- Eseguire questo script sul database di produzione

-- Verifica e aggiungi colonna political_opinions_consent
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'political_opinions_consent'
    ) THEN
        ALTER TABLE users 
        ADD COLUMN political_opinions_consent BOOLEAN DEFAULT false;
        RAISE NOTICE 'Colonna political_opinions_consent aggiunta';
    ELSE
        RAISE NOTICE 'Colonna political_opinions_consent esiste già';
    END IF;
END $$;

-- Verifica e aggiungi colonna political_opinions_consent_timestamp
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'political_opinions_consent_timestamp'
    ) THEN
        ALTER TABLE users 
        ADD COLUMN political_opinions_consent_timestamp TIMESTAMP WITH TIME ZONE;
        RAISE NOTICE 'Colonna political_opinions_consent_timestamp aggiunta';
    ELSE
        RAISE NOTICE 'Colonna political_opinions_consent_timestamp esiste già';
    END IF;
END $$;

-- Verifica e aggiungi colonna political_opinions_consent_ip_address
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'political_opinions_consent_ip_address'
    ) THEN
        ALTER TABLE users 
        ADD COLUMN political_opinions_consent_ip_address VARCHAR(45);
        RAISE NOTICE 'Colonna political_opinions_consent_ip_address aggiunta';
    ELSE
        RAISE NOTICE 'Colonna political_opinions_consent_ip_address esiste già';
    END IF;
END $$;

-- Verifica e aggiungi colonna political_opinions_consent_user_agent
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'political_opinions_consent_user_agent'
    ) THEN
        ALTER TABLE users 
        ADD COLUMN political_opinions_consent_user_agent TEXT;
        RAISE NOTICE 'Colonna political_opinions_consent_user_agent aggiunta';
    ELSE
        RAISE NOTICE 'Colonna political_opinions_consent_user_agent esiste già';
    END IF;
END $$;

-- Crea indice se non esiste
CREATE INDEX IF NOT EXISTS idx_users_political_opinions_consent 
ON users(political_opinions_consent)
WHERE political_opinions_consent = true;

-- Verifica finale
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name LIKE 'political_opinions_consent%'
ORDER BY column_name;
