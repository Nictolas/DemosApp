-- Script per aggiornare il ruolo da "P" a "E" per tutti i politici
-- che hanno ruolo "P" e grado_elezione "C" o "S" ma non sono attualmente eletti in Parlamento
--
-- Criteri per considerare un politico "non eletto":
-- 1. Non ha un URL Openpolis valido configurato
-- 2. O ha un URL ma non ha votazioni recenti (ultimo_aggiornamento > 6 mesi fa o NULL)
-- 3. O non esiste nella tabella voti_camera

BEGIN;

-- ============================================
-- AGGIORNA RUOLO DA "P" A "E" PER POLITICI NON ELETTI
-- ============================================

-- Strategia: Aggiorna tutti i politici con ruolo "P" e grado_elezione "C" o "S"
-- che NON hanno:
-- - Un URL Openpolis valido (non vuoto e che inizia con https://parlamento19.openpolis.it)
-- - E un ultimo_aggiornamento recente (negli ultimi 6 mesi) in voti_camera

UPDATE users u
SET ruolo = 'E',
    updated_at = CURRENT_TIMESTAMP
WHERE u.ruolo = 'P'
  AND (u.grado_elezione = 'C' OR u.grado_elezione = 'S')
  AND u.status = 'a'
  AND NOT EXISTS (
    -- Escludi se ha un URL Openpolis valido E dati recenti in voti_camera
    SELECT 1
    FROM voti_camera vc
    WHERE vc.politico_nome = CONCAT(u.nome, ' ', u.cognome)
      AND vc.url_openpolis IS NOT NULL
      AND vc.url_openpolis != ''
      AND vc.url_openpolis LIKE 'https://parlamento19.openpolis.it%'
      AND (
        -- Ha un aggiornamento recente (negli ultimi 6 mesi)
        vc.ultimo_aggiornamento >= CURRENT_DATE - INTERVAL '6 months'
        OR
        -- O ha una votazione recente (negli ultimi 6 mesi)
        vc.data_votazione >= CURRENT_DATE - INTERVAL '6 months'
      )
  )
  -- Escludi anche se ha un URL valido anche senza dati recenti (potrebbe essere appena aggiunto)
  AND NOT EXISTS (
    SELECT 1
    FROM voti_camera vc2
    WHERE vc2.politico_nome = CONCAT(u.nome, ' ', u.cognome)
      AND vc2.url_openpolis IS NOT NULL
      AND vc2.url_openpolis != ''
      AND vc2.url_openpolis LIKE 'https://parlamento19.openpolis.it%'
  );

-- Mostra statistiche
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Aggiornati % politici da ruolo "P" a "E"', updated_count;
END $$;

COMMIT;

-- ============================================
-- VERIFICA RISULTATI
-- ============================================

-- Mostra quanti politici rimangono con ruolo "P" e grado_elezione "C" o "S"
SELECT 
  'Politici ancora con ruolo P (attualmente eletti)' as report,
  COUNT(*) as totale
FROM users u
WHERE u.ruolo = 'P'
  AND (u.grado_elezione = 'C' OR u.grado_elezione = 'S')
  AND u.status = 'a';

-- Mostra quanti politici sono stati aggiornati a "E"
SELECT 
  'Politici aggiornati a ruolo E' as report,
  COUNT(*) as totale
FROM users u
WHERE u.ruolo = 'E'
  AND (u.grado_elezione = 'C' OR u.grado_elezione = 'S')
  AND u.status = 'a';

-- Mostra alcuni esempi di politici aggiornati
SELECT 
  'Esempi politici aggiornati a E' as report,
  u.nome,
  u.cognome,
  u.grado_elezione,
  u.ruolo
FROM users u
WHERE u.ruolo = 'E'
  AND (u.grado_elezione = 'C' OR u.grado_elezione = 'S')
  AND u.status = 'a'
ORDER BY u.cognome, u.nome
LIMIT 20;
