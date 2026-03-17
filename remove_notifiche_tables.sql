-- Script per rimuovere le tabelle notifiche_utente e user_notifications
-- Queste tabelle non sono più utilizzate, il sistema usa la tabella 'comunicazioni' per le notifiche

-- Rimuovi la tabella notifiche_utente se esiste
DROP TABLE IF EXISTS notifiche_utente CASCADE;

-- Rimuovi la tabella user_notifications se esiste
DROP TABLE IF EXISTS user_notifications CASCADE;

-- Verifica che le tabelle siano state rimosse
DO $$
BEGIN
    -- Verifica notifiche_utente
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'notifiche_utente'
    ) THEN
        RAISE NOTICE '⚠️ La tabella notifiche_utente esiste ancora';
    ELSE
        RAISE NOTICE '✅ Tabella notifiche_utente rimossa con successo';
    END IF;

    -- Verifica user_notifications
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'user_notifications'
    ) THEN
        RAISE NOTICE '⚠️ La tabella user_notifications esiste ancora';
    ELSE
        RAISE NOTICE '✅ Tabella user_notifications rimossa con successo';
    END IF;
END $$;

