-- Script per cancellare la tabella "notifiche_comunali" 
-- e rinominare "informa_cittadini" in "notifiche_comunali"

-- ============================================
-- PARTE 1: Cancellare la tabella "notifiche_comunali" se esiste
-- ============================================

DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'notifiche_comunali'
    ) THEN
        DROP TABLE notifiche_comunali CASCADE;
        RAISE NOTICE 'Tabella "notifiche_comunali" cancellata';
    ELSE
        RAISE NOTICE 'Tabella "notifiche_comunali" non trovata, saltata';
    END IF;
END $$;

-- ============================================
-- PARTE 2: Rinominare "informa_cittadini" in "notifiche_comunali"
-- ============================================

DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'informa_cittadini'
    ) THEN
        ALTER TABLE informa_cittadini RENAME TO notifiche_comunali;
        RAISE NOTICE 'Tabella "informa_cittadini" rinominata in "notifiche_comunali"';
    ELSE
        RAISE NOTICE 'Tabella "informa_cittadini" non trovata, saltata';
    END IF;
END $$;

-- ============================================
-- PARTE 3: Verifica finale struttura tabella
-- ============================================

-- Mostra la struttura della tabella notifiche_comunali
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'notifiche_comunali'
ORDER BY ordinal_position;

