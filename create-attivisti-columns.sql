-- Script SQL per creare le colonne attivisti e organizzazioni nella tabella users

-- Controlla se la colonna attivisti esiste già, se no la crea
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'attivisti'
    ) THEN
        ALTER TABLE users ADD COLUMN attivisti VARCHAR(255) DEFAULT NULL;
        RAISE NOTICE 'Colonna attivisti creata';
    ELSE
        RAISE NOTICE 'Colonna attivisti esiste già';
    END IF;
END $$;

-- Controlla se la colonna organizzazioni esiste già, se no la crea
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'organizzazioni'
    ) THEN
        ALTER TABLE users ADD COLUMN organizzazioni VARCHAR(255) DEFAULT NULL;
        RAISE NOTICE 'Colonna organizzazioni creata';
    ELSE
        RAISE NOTICE 'Colonna organizzazioni esiste già';
    END IF;
END $$;

-- Verifica se la foreign key per attivisti esiste
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_attivisti' 
        AND table_name = 'users'
    ) THEN
        ALTER TABLE users 
        ADD CONSTRAINT fk_attivisti 
        FOREIGN KEY (attivisti) REFERENCES users(id);
        RAISE NOTICE 'Foreign key fk_attivisti creata';
    ELSE
        RAISE NOTICE 'Foreign key fk_attivisti esiste già';
    END IF;
END $$;

-- Verifica se la foreign key per organizzazioni esiste
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_organizzazioni' 
        AND table_name = 'users'
    ) THEN
        ALTER TABLE users 
        ADD CONSTRAINT fk_organizzazioni 
        FOREIGN KEY (organizzazioni) REFERENCES users(id);
        RAISE NOTICE 'Foreign key fk_organizzazioni creata';
    ELSE
        RAISE NOTICE 'Foreign key fk_organizzazioni esiste già';
    END IF;
END $$;

-- Crea indici se non esistono
CREATE INDEX IF NOT EXISTS idx_users_attivisti ON users (attivisti);
CREATE INDEX IF NOT EXISTS idx_users_organizzazioni ON users (organizzazioni);

-- Verifica la struttura finale
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name IN ('attivisti', 'organizzazioni')
ORDER BY column_name;

