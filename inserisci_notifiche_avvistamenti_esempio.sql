-- Script per inserire 3 notifiche di esempio nella tabella notifiche_avvistamenti
-- Le notifiche vengono associate a utenti reali con comune_residenza

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
        RAISE EXCEPTION 'Tabella notifiche_avvistamenti non trovata. Esegui prima crea_tabella_notifiche_avvistamenti.sql';
    END IF;
END $$;

-- ============================================
-- PARTE 2: Seleziona utenti con comune_residenza
-- ============================================

-- Trova 3 utenti diversi con comune_residenza impostato
-- Se non ci sono abbastanza utenti, userà lo stesso utente per tutte le notifiche

-- ============================================
-- PARTE 3: Inserisci 3 notifiche di esempio
-- ============================================

-- Notifica 1: Avvistamento Lupo
INSERT INTO notifiche_avvistamenti (
    id_utente,
    tipo_avvistamento,
    titolo,
    testo,
    comune_residenza,
    data,
    data_creazione,
    metadata
)
SELECT 
    u.id,
    'Lupo',
    'Avvistamento Lupo',
    'Un cittadino ha segnalato un avvistamento di lupo nel comune. Presta attenzione se ti trovi nella zona e mantieni la distanza di sicurezza.',
    u.comune_residenza,
    CURRENT_TIMESTAMP - INTERVAL '2 days',
    CURRENT_TIMESTAMP - INTERVAL '2 days',
    '{"zona": "Periferia nord", "ora": "18:30"}'::jsonb
FROM users u
WHERE u.comune_residenza IS NOT NULL
  AND u.comune_residenza != ''
LIMIT 1;

-- Notifica 2: Avvistamento Cinghiale
INSERT INTO notifiche_avvistamenti (
    id_utente,
    tipo_avvistamento,
    titolo,
    testo,
    comune_residenza,
    data,
    data_creazione,
    metadata
)
SELECT 
    u.id,
    'Cinghiale',
    'Avvistamento Cinghiale',
    'Un cittadino ha segnalato un gruppo di cinghiali in prossimità delle abitazioni. Si consiglia di evitare la zona e di non avvicinarsi agli animali.',
    u.comune_residenza,
    CURRENT_TIMESTAMP - INTERVAL '1 day',
    CURRENT_TIMESTAMP - INTERVAL '1 day',
    '{"zona": "Centro storico", "numero_animali": "3-4"}'::jsonb
FROM users u
WHERE u.comune_residenza IS NOT NULL
  AND u.comune_residenza != ''
  AND u.id NOT IN (SELECT id_utente FROM notifiche_avvistamenti WHERE tipo_avvistamento = 'Lupo' LIMIT 1)
LIMIT 1;

-- Se non troviamo un secondo utente, usiamo lo stesso del primo
INSERT INTO notifiche_avvistamenti (
    id_utente,
    tipo_avvistamento,
    titolo,
    testo,
    comune_residenza,
    data,
    data_creazione,
    metadata
)
SELECT 
    u.id,
    'Cinghiale',
    'Avvistamento Cinghiale',
    'Un cittadino ha segnalato un gruppo di cinghiali in prossimità delle abitazioni. Si consiglia di evitare la zona e di non avvicinarsi agli animali.',
    u.comune_residenza,
    CURRENT_TIMESTAMP - INTERVAL '1 day',
    CURRENT_TIMESTAMP - INTERVAL '1 day',
    '{"zona": "Centro storico", "numero_animali": "3-4"}'::jsonb
FROM users u
WHERE u.comune_residenza IS NOT NULL
  AND u.comune_residenza != ''
  AND NOT EXISTS (
    SELECT 1 FROM notifiche_avvistamenti 
    WHERE tipo_avvistamento = 'Cinghiale' 
    AND id_utente = u.id
  )
LIMIT 1;

-- Notifica 3: Avvistamento Volpe
INSERT INTO notifiche_avvistamenti (
    id_utente,
    tipo_avvistamento,
    titolo,
    testo,
    comune_residenza,
    data,
    data_creazione,
    metadata
)
SELECT 
    u.id,
    'Volpe',
    'Avvistamento Volpe',
    'Un cittadino ha segnalato un avvistamento di volpe in zona residenziale. L''animale sembrava in buone condizioni. Si consiglia di non avvicinarsi e di tenere gli animali domestici al sicuro.',
    u.comune_residenza,
    CURRENT_TIMESTAMP - INTERVAL '3 hours',
    CURRENT_TIMESTAMP - INTERVAL '3 hours',
    '{"zona": "Parco comunale", "condizioni": "buone"}'::jsonb
FROM users u
WHERE u.comune_residenza IS NOT NULL
  AND u.comune_residenza != ''
  AND u.id NOT IN (
    SELECT id_utente FROM notifiche_avvistamenti 
    WHERE tipo_avvistamento IN ('Lupo', 'Cinghiale') 
    LIMIT 2
  )
LIMIT 1;

-- Se non troviamo un terzo utente, usiamo uno dei precedenti
INSERT INTO notifiche_avvistamenti (
    id_utente,
    tipo_avvistamento,
    titolo,
    testo,
    comune_residenza,
    data,
    data_creazione,
    metadata
)
SELECT 
    u.id,
    'Volpe',
    'Avvistamento Volpe',
    'Un cittadino ha segnalato un avvistamento di volpe in zona residenziale. L''animale sembrava in buone condizioni. Si consiglia di non avvicinarsi e di tenere gli animali domestici al sicuro.',
    u.comune_residenza,
    CURRENT_TIMESTAMP - INTERVAL '3 hours',
    CURRENT_TIMESTAMP - INTERVAL '3 hours',
    '{"zona": "Parco comunale", "condizioni": "buone"}'::jsonb
FROM users u
WHERE u.comune_residenza IS NOT NULL
  AND u.comune_residenza != ''
  AND NOT EXISTS (
    SELECT 1 FROM notifiche_avvistamenti 
    WHERE tipo_avvistamento = 'Volpe' 
    AND id_utente = u.id
  )
LIMIT 1;

-- ============================================
-- PARTE 4: Verifica inserimento
-- ============================================

SELECT 
    id,
    tipo_avvistamento,
    titolo,
    comune_residenza,
    data,
    (SELECT COUNT(*) FROM users WHERE comune_residenza = na.comune_residenza) as cittadini_nel_comune
FROM notifiche_avvistamenti na
ORDER BY data DESC
LIMIT 3;

