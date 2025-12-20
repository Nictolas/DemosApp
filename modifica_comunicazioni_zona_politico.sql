-- Script per modificare la tabella comunicazioni
-- Rimuove colonna: zona
-- Aggiunge colonna: politico

-- ============================================
-- PARTE 1: Rimozione colonna "zona"
-- ============================================

-- Rimuovi colonna "zona" se esiste
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'comunicazioni' AND column_name = 'zona'
    ) THEN
        ALTER TABLE comunicazioni DROP COLUMN zona;
        RAISE NOTICE 'Colonna "zona" rimossa';
    ELSE
        RAISE NOTICE 'Colonna "zona" non trovata, saltata';
    END IF;
END $$;

-- ============================================
-- PARTE 2: Aggiunta colonna "politico"
-- ============================================

-- Aggiungi colonna "politico" se non esiste
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'comunicazioni' AND column_name = 'politico'
    ) THEN
        ALTER TABLE comunicazioni ADD COLUMN politico TEXT;
        RAISE NOTICE 'Colonna "politico" aggiunta';
    ELSE
        RAISE NOTICE 'Colonna "politico" già esistente, saltata';
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

