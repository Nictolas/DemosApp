-- Script per modificare la tabella comunicazioni
-- Rimuove colonne: commento, punti_trasparenza, vincitore, voto_dato, data_creazione, data_aggiornamento
-- Aggiunge colonne: voto, data, comune_residenza

-- ============================================
-- PARTE 1: Rimozione colonne esistenti
-- ============================================

-- Rimuovi colonna "commento" se esiste
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'comunicazioni' AND column_name = 'commento'
    ) THEN
        ALTER TABLE comunicazioni DROP COLUMN commento;
        RAISE NOTICE 'Colonna "commento" rimossa';
    ELSE
        RAISE NOTICE 'Colonna "commento" non trovata, saltata';
    END IF;
END $$;

-- Rimuovi colonna "punti_trasparenza" se esiste
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'comunicazioni' AND column_name = 'punti_trasparenza'
    ) THEN
        ALTER TABLE comunicazioni DROP COLUMN punti_trasparenza;
        RAISE NOTICE 'Colonna "punti_trasparenza" rimossa';
    ELSE
        RAISE NOTICE 'Colonna "punti_trasparenza" non trovata, saltata';
    END IF;
END $$;

-- Rimuovi colonna "vincitore" se esiste
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'comunicazioni' AND column_name = 'vincitore'
    ) THEN
        ALTER TABLE comunicazioni DROP COLUMN vincitore;
        RAISE NOTICE 'Colonna "vincitore" rimossa';
    ELSE
        RAISE NOTICE 'Colonna "vincitore" non trovata, saltata';
    END IF;
END $$;

-- Rimuovi colonna "voto_dato" se esiste
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'comunicazioni' AND column_name = 'voto_dato'
    ) THEN
        ALTER TABLE comunicazioni DROP COLUMN voto_dato;
        RAISE NOTICE 'Colonna "voto_dato" rimossa';
    ELSE
        RAISE NOTICE 'Colonna "voto_dato" non trovata, saltata';
    END IF;
END $$;

-- Rimuovi colonna "data_creazione" se esiste
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'comunicazioni' AND column_name = 'data_creazione'
    ) THEN
        ALTER TABLE comunicazioni DROP COLUMN data_creazione;
        RAISE NOTICE 'Colonna "data_creazione" rimossa';
    ELSE
        RAISE NOTICE 'Colonna "data_creazione" non trovata, saltata';
    END IF;
END $$;

-- Rimuovi colonna "data_aggiornamento" se esiste
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'comunicazioni' AND column_name = 'data_aggiornamento'
    ) THEN
        ALTER TABLE comunicazioni DROP COLUMN data_aggiornamento;
        RAISE NOTICE 'Colonna "data_aggiornamento" rimossa';
    ELSE
        RAISE NOTICE 'Colonna "data_aggiornamento" non trovata, saltata';
    END IF;
END $$;

-- ============================================
-- PARTE 2: Aggiunta nuove colonne
-- ============================================

-- Aggiungi colonna "voto" se non esiste
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'comunicazioni' AND column_name = 'voto'
    ) THEN
        ALTER TABLE comunicazioni ADD COLUMN voto TEXT;
        RAISE NOTICE 'Colonna "voto" aggiunta';
    ELSE
        RAISE NOTICE 'Colonna "voto" già esistente, saltata';
    END IF;
END $$;

-- Aggiungi colonna "data" se non esiste
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'comunicazioni' AND column_name = 'data'
    ) THEN
        ALTER TABLE comunicazioni ADD COLUMN data DATE;
        RAISE NOTICE 'Colonna "data" aggiunta';
    ELSE
        RAISE NOTICE 'Colonna "data" già esistente, saltata';
    END IF;
END $$;

-- Aggiungi colonna "comune_residenza" se non esiste
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'comunicazioni' AND column_name = 'comune_residenza'
    ) THEN
        ALTER TABLE comunicazioni ADD COLUMN comune_residenza TEXT;
        RAISE NOTICE 'Colonna "comune_residenza" aggiunta';
    ELSE
        RAISE NOTICE 'Colonna "comune_residenza" già esistente, saltata';
    END IF;
END $$;

-- ============================================
-- PARTE 3: Verifica finale struttura tabella
-- ============================================

-- Mostra la struttura finale della tabella
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'comunicazioni'
ORDER BY ordinal_position;

