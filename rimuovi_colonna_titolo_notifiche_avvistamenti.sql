-- Script per rimuovere la colonna "titolo" dalla tabella "notifiche_avvistamenti"
-- Il titolo verrà costruito come "Avvistamento {tipo_avvistamento}"

-- ============================================
-- PARTE 1: Verifica che la tabella esista
-- ============================================

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'notifiche_avvistamenti'
    ) THEN
        RAISE EXCEPTION 'Tabella notifiche_avvistamenti non trovata';
    END IF;
END $$;

-- ============================================
-- PARTE 2: Verifica che la colonna esista prima di rimuoverla
-- ============================================

DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'notifiche_avvistamenti' 
        AND column_name = 'titolo'
    ) THEN
        ALTER TABLE notifiche_avvistamenti DROP COLUMN titolo;
        RAISE NOTICE 'Colonna "titolo" rimossa da notifiche_avvistamenti';
    ELSE
        RAISE NOTICE 'Colonna "titolo" non trovata in notifiche_avvistamenti, saltata';
    END IF;
END $$;

-- ============================================
-- PARTE 3: Verifica struttura finale
-- ============================================

SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'notifiche_avvistamenti'
ORDER BY ordinal_position;

