-- Script per impostare di default la spunta "Notifiche Demos" attiva
-- per tutti gli utenti nella colonna notifiche_preferenze

-- Aggiorna tutti gli utenti impostando demos: true nelle preferenze notifiche
-- Preserva le altre preferenze esistenti se ci sono
UPDATE users
SET notifiche_preferenze = COALESCE(
    -- Se esiste già notifiche_preferenze, aggiungi/aggiorna solo 'demos'
    CASE 
        WHEN notifiche_preferenze IS NOT NULL 
        THEN jsonb_set(
            notifiche_preferenze, 
            '{demos}', 
            'true'::jsonb,
            true  -- create_missing = true per creare la chiave se non esiste
        )
        ELSE NULL
    END,
    -- Se notifiche_preferenze è NULL, crea un nuovo oggetto con demos: true
    '{"demos": true}'::jsonb
),
updated_at = NOW()
WHERE notifiche_preferenze IS NULL 
   OR notifiche_preferenze->>'demos' IS NULL
   OR notifiche_preferenze->>'demos' = 'false';

-- Verifica i risultati
SELECT 
    COUNT(*) as totale_utenti,
    COUNT(CASE WHEN notifiche_preferenze->>'demos' = 'true' THEN 1 END) as demos_attivo,
    COUNT(CASE WHEN notifiche_preferenze->>'demos' = 'false' THEN 1 END) as demos_disattivo,
    COUNT(CASE WHEN notifiche_preferenze->>'demos' IS NULL THEN 1 END) as demos_non_impostato
FROM users;

-- Mostra un esempio delle preferenze aggiornate
SELECT 
    id,
    email,
    notifiche_preferenze
FROM users
WHERE notifiche_preferenze->>'demos' = 'true'
LIMIT 5;

