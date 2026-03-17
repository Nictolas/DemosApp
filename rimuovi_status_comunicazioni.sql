-- Script per rimuovere la colonna "status" dalla tabella comunicazioni
-- La colonna "status" è ridondante perché lo stato di lettura dipende dall'utente
-- e viene tracciato tramite la colonna "read_by" (array di UUID)

-- ============================================
-- Rimozione colonna "status"
-- ============================================

-- Rimuovi colonna "status" se esiste
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'comunicazioni' AND column_name = 'status'
    ) THEN
        ALTER TABLE comunicazioni DROP COLUMN status;
        RAISE NOTICE 'Colonna "status" rimossa dalla tabella comunicazioni';
    ELSE
        RAISE NOTICE 'Colonna "status" non trovata, saltata';
    END IF;
END $$;

-- ============================================
-- Verifica finale struttura tabella
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

