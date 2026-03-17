-- Script per impostare di default le notifiche disattivate (false)
-- per tutti gli utenti nella colonna notifiche_preferenze
-- Tranne per Nicolas Micheletti e Mattia Picariello

-- Aggiorna tutti gli utenti impostando demos: false nelle preferenze notifiche
-- Preserva le altre preferenze esistenti se ci sono
-- Esclude Nicolas Micheletti e Mattia Picariello
UPDATE users
SET notifiche_preferenze = COALESCE(
    -- Se esiste già notifiche_preferenze, aggiungi/aggiorna solo 'demos' a false
    CASE 
        WHEN notifiche_preferenze IS NOT NULL 
        THEN jsonb_set(
            notifiche_preferenze, 
            '{demos}', 
            'false'::jsonb,
            true  -- create_missing = true per creare la chiave se non esiste
        )
        ELSE NULL
    END,
    -- Se notifiche_preferenze è NULL, crea un nuovo oggetto con demos: false
    '{"demos": false}'::jsonb
),
updated_at = NOW()
WHERE NOT (
    -- Escludi Nicolas Micheletti
    (nome ILIKE '%nicolas%' AND cognome ILIKE '%micheletti%')
    OR
    -- Escludi Mattia Picariello
    (nome ILIKE '%mattia%' AND cognome ILIKE '%picariello%')
);

-- Verifica i risultati
SELECT 
    COUNT(*) as totale_utenti,
    COUNT(CASE WHEN notifiche_preferenze->>'demos' = 'true' THEN 1 END) as demos_attivo,
    COUNT(CASE WHEN notifiche_preferenze->>'demos' = 'false' THEN 1 END) as demos_disattivo,
    COUNT(CASE WHEN notifiche_preferenze->>'demos' IS NULL THEN 1 END) as demos_non_impostato
FROM users;

-- Verifica che Nicolas Micheletti e Mattia Picariello non siano stati modificati
SELECT 
    id,
    nome,
    cognome,
    email,
    notifiche_preferenze->>'demos' as demos_preferenza
FROM users
WHERE (nome ILIKE '%nicolas%' AND cognome ILIKE '%micheletti%')
   OR (nome ILIKE '%mattia%' AND cognome ILIKE '%picariello%')
ORDER BY nome, cognome;

-- Mostra un esempio degli utenti aggiornati (esclusi i due utenti)
SELECT 
    id,
    email,
    nome,
    cognome,
    notifiche_preferenze->>'demos' as demos_preferenza
FROM users
WHERE NOT (
    (nome ILIKE '%nicolas%' AND cognome ILIKE '%micheletti%')
    OR (nome ILIKE '%mattia%' AND cognome ILIKE '%picariello%')
)
AND notifiche_preferenze->>'demos' = 'false'
LIMIT 10;

