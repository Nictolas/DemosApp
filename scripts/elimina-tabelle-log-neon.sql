-- ============================================
-- 🗑️ SCRIPT ELIMINAZIONE TABELLE LOG DA NEON
-- ============================================
-- 
-- ⚠️  ATTENZIONE: Esegui questo script SOLO DOPO aver verificato:
--   1. ✅ AXIOM_ENABLED=true su Render
--   2. ✅ I dataset su Axiom contengono i dati
--   3. ✅ Tutte le funzionalità funzionano correttamente in produzione
--   4. ✅ Hai fatto backup del database (opzionale ma consigliato)
--
-- ============================================

-- Verifica che le tabelle esistano prima di eliminarle
DO $$
BEGIN
    -- Verifica esistenza tabelle
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'centralized_logs') THEN
        RAISE NOTICE 'Trovata tabella: centralized_logs';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs') THEN
        RAISE NOTICE 'Trovata tabella: audit_logs';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'centralized_logs_compressed') THEN
        RAISE NOTICE 'Trovata tabella: centralized_logs_compressed';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs_compressed') THEN
        RAISE NOTICE 'Trovata tabella: audit_logs_compressed';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'centralized_logs_decompressed') THEN
        RAISE NOTICE 'Trovata tabella: centralized_logs_decompressed (VIEW)';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs_decompressed') THEN
        RAISE NOTICE 'Trovata tabella: audit_logs_decompressed (VIEW)';
    END IF;
END $$;

-- ============================================
-- ELIMINAZIONE TABELLE E VISTE
-- ============================================

-- Elimina viste (se esistono)
DROP VIEW IF EXISTS centralized_logs_decompressed CASCADE;
DROP VIEW IF EXISTS audit_logs_decompressed CASCADE;

-- Elimina tabelle compresse (se esistono)
DROP TABLE IF EXISTS centralized_logs_compressed CASCADE;
DROP TABLE IF EXISTS audit_logs_compressed CASCADE;

-- Elimina tabelle principali (se esistono)
DROP TABLE IF EXISTS centralized_logs CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;

-- ============================================
-- VERIFICA ELIMINAZIONE
-- ============================================

DO $$
DECLARE
    tables_exist BOOLEAN := FALSE;
BEGIN
    -- Verifica che le tabelle siano state eliminate
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name IN (
            'centralized_logs', 
            'audit_logs', 
            'centralized_logs_compressed', 
            'audit_logs_compressed',
            'centralized_logs_decompressed',
            'audit_logs_decompressed'
        )
    ) INTO tables_exist;
    
    IF NOT tables_exist THEN
        RAISE NOTICE '✅ Tutte le tabelle sono state eliminate con successo!';
    ELSE
        RAISE WARNING '⚠️  Alcune tabelle potrebbero essere ancora presenti. Verifica manualmente.';
    END IF;
END $$;

-- ============================================
-- FINE SCRIPT
-- ============================================

