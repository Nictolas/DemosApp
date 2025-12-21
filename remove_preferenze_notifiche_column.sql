-- Script per eliminare la colonna preferenze_notifiche dalla tabella users
-- Questa colonna è duplicata, si usa notifiche_preferenze invece

-- Prima verifica che la colonna esista
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'preferenze_notifiche'
    ) THEN
        -- Se esistono dati in preferenze_notifiche che non sono in notifiche_preferenze,
        -- copiali prima di eliminare (opzionale, commentato)
        -- UPDATE users 
        -- SET notifiche_preferenze = COALESCE(notifiche_preferenze, preferenze_notifiche, '{}'::jsonb)
        -- WHERE preferenze_notifiche IS NOT NULL 
        --   AND (notifiche_preferenze IS NULL OR notifiche_preferenze = '{}'::jsonb);
        
        -- Elimina la colonna preferenze_notifiche
        ALTER TABLE users DROP COLUMN preferenze_notifiche;
        RAISE NOTICE 'Colonna preferenze_notifiche eliminata con successo';
    ELSE
        RAISE NOTICE 'Colonna preferenze_notifiche non esiste, nessuna operazione necessaria';
    END IF;
END $$;

-- Verifica che la colonna sia stata eliminata
SELECT 
    column_name, 
    data_type
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name IN ('preferenze_notifiche', 'notifiche_preferenze')
ORDER BY column_name;

-- Verifica che notifiche_preferenze esista ancora
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_name = 'users' 
            AND column_name = 'notifiche_preferenze'
        ) THEN '✅ Colonna notifiche_preferenze presente'
        ELSE '❌ Colonna notifiche_preferenze NON presente'
    END as verifica;


