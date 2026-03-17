-- Script per rimuovere la tabella notifiche_utente
-- La tabella non è più utilizzata perché ora si usa la colonna read_by nella tabella comunicazioni

-- Verifica se la tabella esiste prima di eliminarla
DO $$
BEGIN
    -- Elimina la tabella se esiste
    -- CASCADE rimuove automaticamente eventuali foreign key o dipendenze
    IF EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'notifiche_utente'
    ) THEN
        DROP TABLE IF EXISTS notifiche_utente CASCADE;
        RAISE NOTICE '✅ Tabella notifiche_utente eliminata con successo';
    ELSE
        RAISE NOTICE 'ℹ️ Tabella notifiche_utente non esiste, nessuna azione necessaria';
    END IF;
END $$;

-- Verifica che la tabella sia stata eliminata
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'notifiche_utente'
        ) THEN '❌ ERRORE: La tabella notifiche_utente esiste ancora'
        ELSE '✅ CONFERMA: La tabella notifiche_utente è stata eliminata correttamente'
    END as risultato;

