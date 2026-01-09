-- Script per aggiornare il ruolo da "P" a "E" per politici non eletti/non più in Parlamento
-- e eliminare i politici deceduti

BEGIN;

-- ============================================
-- 1. AGGIORNA RUOLO DA "P" A "E"
-- ============================================
-- Leader e figure di spicco NON eletti (o decaduti/dimessi)

UPDATE users
SET ruolo = 'E',
    updated_at = CURRENT_TIMESTAMP
WHERE ruolo = 'P'
  AND (
    -- Luigi Di Maio
    (LOWER(TRIM(nome)) = LOWER(TRIM('Luigi')) AND LOWER(TRIM(cognome)) = LOWER(TRIM('Di Maio')))
    OR
    -- Pier Luigi Bersani
    (LOWER(TRIM(nome)) = LOWER(TRIM('Pier Luigi')) AND LOWER(TRIM(cognome)) = LOWER(TRIM('Bersani')))
    OR
    -- Enrico Letta
    (LOWER(TRIM(nome)) = LOWER(TRIM('Enrico')) AND LOWER(TRIM(cognome)) = LOWER(TRIM('Letta')))
    OR
    -- Roberto Fico
    (LOWER(TRIM(nome)) = LOWER(TRIM('Roberto')) AND LOWER(TRIM(cognome)) = LOWER(TRIM('Fico')))
    OR
    -- Alfonso Bonafede
    (LOWER(TRIM(nome)) = LOWER(TRIM('Alfonso')) AND LOWER(TRIM(cognome)) = LOWER(TRIM('Bonafede')))
    OR
    -- Vito Claudio Crimi
    (LOWER(TRIM(nome)) = LOWER(TRIM('Vito Claudio')) AND LOWER(TRIM(cognome)) = LOWER(TRIM('Crimi')))
    OR
    -- Paola Binetti
    (LOWER(TRIM(nome)) = LOWER(TRIM('Paola')) AND LOWER(TRIM(cognome)) = LOWER(TRIM('Binetti')))
    OR
    -- Renato Brunetta
    (LOWER(TRIM(nome)) = LOWER(TRIM('Renato')) AND LOWER(TRIM(cognome)) = LOWER(TRIM('Brunetta')))
    OR
    -- Angelino Alfano
    (LOWER(TRIM(nome)) = LOWER(TRIM('Angelino')) AND LOWER(TRIM(cognome)) = LOWER(TRIM('Alfano')))
    OR
    -- Pietro Grasso
    (LOWER(TRIM(nome)) = LOWER(TRIM('Pietro')) AND LOWER(TRIM(cognome)) = LOWER(TRIM('Grasso')))
    OR
    -- Laura Castelli
    (LOWER(TRIM(nome)) = LOWER(TRIM('Laura')) AND LOWER(TRIM(cognome)) = LOWER(TRIM('Castelli')))
    OR
    -- Paolo Gentiloni
    (LOWER(TRIM(nome)) = LOWER(TRIM('Paolo')) AND LOWER(TRIM(cognome)) = LOWER(TRIM('Gentiloni')))
    OR
    -- Antonio Decaro
    (LOWER(TRIM(nome)) = LOWER(TRIM('Antonio')) AND LOWER(TRIM(cognome)) = LOWER(TRIM('Decaro')))
    OR
    -- Sandro Gozi
    (LOWER(TRIM(nome)) = LOWER(TRIM('Sandro')) AND LOWER(TRIM(cognome)) = LOWER(TRIM('Gozi')))
    OR
    -- Anna Cinzia Bonfrisco
    (LOWER(TRIM(nome)) = LOWER(TRIM('Anna Cinzia')) AND LOWER(TRIM(cognome)) = LOWER(TRIM('Bonfrisco')))
    OR
    -- Massimiliano Fedriga
    (LOWER(TRIM(nome)) = LOWER(TRIM('Massimiliano')) AND LOWER(TRIM(cognome)) = LOWER(TRIM('Fedriga')))
    OR
    -- Alessandro Di Battista
    (LOWER(TRIM(nome)) = LOWER(TRIM('Alessandro')) AND LOWER(TRIM(cognome)) = LOWER(TRIM('Di Battista')))
    OR
    -- Rosy Bindi
    (LOWER(TRIM(nome)) = LOWER(TRIM('Rosy')) AND LOWER(TRIM(cognome)) = LOWER(TRIM('Bindi')))
    OR
    -- Stefano Fassina
    (LOWER(TRIM(nome)) = LOWER(TRIM('Stefano')) AND LOWER(TRIM(cognome)) = LOWER(TRIM('Fassina')))
    OR
    -- Nunzia De Girolamo
    (LOWER(TRIM(nome)) = LOWER(TRIM('Nunzia')) AND LOWER(TRIM(cognome)) = LOWER(TRIM('De Girolamo')))
    OR
    -- Daniele Capezzone
    (LOWER(TRIM(nome)) = LOWER(TRIM('Daniele')) AND LOWER(TRIM(cognome)) = LOWER(TRIM('Capezzone')))
    OR
    -- Ilaria Capua
    (LOWER(TRIM(nome)) = LOWER(TRIM('Ilaria')) AND LOWER(TRIM(cognome)) = LOWER(TRIM('Capua')))
    OR
    -- Giancarlo Galan
    (LOWER(TRIM(nome)) = LOWER(TRIM('Giancarlo')) AND LOWER(TRIM(cognome)) = LOWER(TRIM('Galan')))
    OR
    -- Roberto Formigoni
    (LOWER(TRIM(nome)) = LOWER(TRIM('Roberto')) AND LOWER(TRIM(cognome)) = LOWER(TRIM('Formigoni')))
  );

-- ============================================
-- 2. ELIMINA POLITICI DECEDUTI
-- ============================================

-- Prima elimina i record correlati in voti_camera
DELETE FROM voti_camera
WHERE politico_nome IN (
  SELECT nome || ' ' || cognome
  FROM users
  WHERE ruolo = 'P'
    AND (
      (LOWER(TRIM(nome)) = LOWER(TRIM('Niccolò')) AND LOWER(TRIM(cognome)) = LOWER(TRIM('Ghedini')))
      OR
      (LOWER(TRIM(nome)) = LOWER(TRIM('Bruno')) AND LOWER(TRIM(cognome)) = LOWER(TRIM('Astorre')))
      OR
      (LOWER(TRIM(nome)) = LOWER(TRIM('Andrea')) AND LOWER(TRIM(cognome)) = LOWER(TRIM('Augello')))
      OR
      (LOWER(TRIM(nome)) = LOWER(TRIM('Ettore')) AND LOWER(TRIM(cognome)) = LOWER(TRIM('Epifani')))
      OR
      (LOWER(TRIM(nome)) = LOWER(TRIM('Enrico')) AND LOWER(TRIM(cognome)) = LOWER(TRIM('Buemi')))
    )
);

-- Elimina le notifiche correlate
DELETE FROM notifiche_voti_parlamento
WHERE politico IN (
  SELECT nome || ' ' || cognome
  FROM users
  WHERE ruolo = 'P'
    AND (
      (LOWER(TRIM(nome)) = LOWER(TRIM('Niccolò')) AND LOWER(TRIM(cognome)) = LOWER(TRIM('Ghedini')))
      OR
      (LOWER(TRIM(nome)) = LOWER(TRIM('Bruno')) AND LOWER(TRIM(cognome)) = LOWER(TRIM('Astorre')))
      OR
      (LOWER(TRIM(nome)) = LOWER(TRIM('Andrea')) AND LOWER(TRIM(cognome)) = LOWER(TRIM('Augello')))
      OR
      (LOWER(TRIM(nome)) = LOWER(TRIM('Ettore')) AND LOWER(TRIM(cognome)) = LOWER(TRIM('Epifani')))
      OR
      (LOWER(TRIM(nome)) = LOWER(TRIM('Enrico')) AND LOWER(TRIM(cognome)) = LOWER(TRIM('Buemi')))
    )
);

-- Rimuovi i riferimenti come rappresentante dagli altri utenti
-- Usa una CTE per evitare problemi di tipo
WITH deceduti_ids AS (
  SELECT id::uuid
  FROM users
  WHERE ruolo = 'P'
    AND (
      (LOWER(TRIM(nome)) = LOWER(TRIM('Niccolò')) AND LOWER(TRIM(cognome)) = LOWER(TRIM('Ghedini')))
      OR
      (LOWER(TRIM(nome)) = LOWER(TRIM('Bruno')) AND LOWER(TRIM(cognome)) = LOWER(TRIM('Astorre')))
      OR
      (LOWER(TRIM(nome)) = LOWER(TRIM('Andrea')) AND LOWER(TRIM(cognome)) = LOWER(TRIM('Augello')))
      OR
      (LOWER(TRIM(nome)) = LOWER(TRIM('Ettore')) AND LOWER(TRIM(cognome)) = LOWER(TRIM('Epifani')))
      OR
      (LOWER(TRIM(nome)) = LOWER(TRIM('Enrico')) AND LOWER(TRIM(cognome)) = LOWER(TRIM('Buemi')))
    )
)
UPDATE users
SET rappresentante_camera = NULL,
    rappresentante_senato = NULL,
    updated_at = CURRENT_TIMESTAMP
WHERE rappresentante_camera::uuid IN (SELECT id FROM deceduti_ids)
   OR rappresentante_senato::uuid IN (SELECT id FROM deceduti_ids);

-- Infine elimina gli utenti deceduti
DELETE FROM users
WHERE ruolo = 'P'
  AND (
    (LOWER(TRIM(nome)) = LOWER(TRIM('Niccolò')) AND LOWER(TRIM(cognome)) = LOWER(TRIM('Ghedini')))
    OR
    (LOWER(TRIM(nome)) = LOWER(TRIM('Bruno')) AND LOWER(TRIM(cognome)) = LOWER(TRIM('Astorre')))
    OR
    (LOWER(TRIM(nome)) = LOWER(TRIM('Andrea')) AND LOWER(TRIM(cognome)) = LOWER(TRIM('Augello')))
    OR
    (LOWER(TRIM(nome)) = LOWER(TRIM('Ettore')) AND LOWER(TRIM(cognome)) = LOWER(TRIM('Epifani')))
    OR
    (LOWER(TRIM(nome)) = LOWER(TRIM('Enrico')) AND LOWER(TRIM(cognome)) = LOWER(TRIM('Buemi')))
  );

COMMIT;

-- Verifica risultati
SELECT 
  'Utenti aggiornati a ruolo E' as report,
  COUNT(*) as totale
FROM users
WHERE ruolo = 'E'
  AND (
    (LOWER(TRIM(nome)) = LOWER(TRIM('Luigi')) AND LOWER(TRIM(cognome)) = LOWER(TRIM('Di Maio')))
    OR (LOWER(TRIM(nome)) = LOWER(TRIM('Pier Luigi')) AND LOWER(TRIM(cognome)) = LOWER(TRIM('Bersani')))
    OR (LOWER(TRIM(nome)) = LOWER(TRIM('Enrico')) AND LOWER(TRIM(cognome)) = LOWER(TRIM('Letta')))
    OR (LOWER(TRIM(nome)) = LOWER(TRIM('Roberto')) AND LOWER(TRIM(cognome)) = LOWER(TRIM('Fico')))
    OR (LOWER(TRIM(nome)) = LOWER(TRIM('Alfonso')) AND LOWER(TRIM(cognome)) = LOWER(TRIM('Bonafede')))
    OR (LOWER(TRIM(nome)) = LOWER(TRIM('Vito Claudio')) AND LOWER(TRIM(cognome)) = LOWER(TRIM('Crimi')))
    OR (LOWER(TRIM(nome)) = LOWER(TRIM('Paola')) AND LOWER(TRIM(cognome)) = LOWER(TRIM('Binetti')))
    OR (LOWER(TRIM(nome)) = LOWER(TRIM('Renato')) AND LOWER(TRIM(cognome)) = LOWER(TRIM('Brunetta')))
    OR (LOWER(TRIM(nome)) = LOWER(TRIM('Angelino')) AND LOWER(TRIM(cognome)) = LOWER(TRIM('Alfano')))
    OR (LOWER(TRIM(nome)) = LOWER(TRIM('Pietro')) AND LOWER(TRIM(cognome)) = LOWER(TRIM('Grasso')))
    OR (LOWER(TRIM(nome)) = LOWER(TRIM('Laura')) AND LOWER(TRIM(cognome)) = LOWER(TRIM('Castelli')))
    OR (LOWER(TRIM(nome)) = LOWER(TRIM('Paolo')) AND LOWER(TRIM(cognome)) = LOWER(TRIM('Gentiloni')))
    OR (LOWER(TRIM(nome)) = LOWER(TRIM('Antonio')) AND LOWER(TRIM(cognome)) = LOWER(TRIM('Decaro')))
    OR (LOWER(TRIM(nome)) = LOWER(TRIM('Sandro')) AND LOWER(TRIM(cognome)) = LOWER(TRIM('Gozi')))
    OR (LOWER(TRIM(nome)) = LOWER(TRIM('Anna Cinzia')) AND LOWER(TRIM(cognome)) = LOWER(TRIM('Bonfrisco')))
    OR (LOWER(TRIM(nome)) = LOWER(TRIM('Massimiliano')) AND LOWER(TRIM(cognome)) = LOWER(TRIM('Fedriga')))
    OR (LOWER(TRIM(nome)) = LOWER(TRIM('Alessandro')) AND LOWER(TRIM(cognome)) = LOWER(TRIM('Di Battista')))
    OR (LOWER(TRIM(nome)) = LOWER(TRIM('Rosy')) AND LOWER(TRIM(cognome)) = LOWER(TRIM('Bindi')))
    OR (LOWER(TRIM(nome)) = LOWER(TRIM('Stefano')) AND LOWER(TRIM(cognome)) = LOWER(TRIM('Fassina')))
    OR (LOWER(TRIM(nome)) = LOWER(TRIM('Nunzia')) AND LOWER(TRIM(cognome)) = LOWER(TRIM('De Girolamo')))
    OR (LOWER(TRIM(nome)) = LOWER(TRIM('Daniele')) AND LOWER(TRIM(cognome)) = LOWER(TRIM('Capezzone')))
    OR (LOWER(TRIM(nome)) = LOWER(TRIM('Ilaria')) AND LOWER(TRIM(cognome)) = LOWER(TRIM('Capua')))
    OR (LOWER(TRIM(nome)) = LOWER(TRIM('Giancarlo')) AND LOWER(TRIM(cognome)) = LOWER(TRIM('Galan')))
    OR (LOWER(TRIM(nome)) = LOWER(TRIM('Roberto')) AND LOWER(TRIM(cognome)) = LOWER(TRIM('Formigoni')))
  );
