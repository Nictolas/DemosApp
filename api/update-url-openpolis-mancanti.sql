-- Script per aggiornare gli URL Openpolis mancanti nella tabella voti_camera
-- Costruisce automaticamente gli URL usando nome, cognome e data di nascita dalla tabella users

-- Funzione helper per normalizzare i nomi (rimuove accenti, caratteri speciali)
-- Se esiste già, la ricrea per sicurezza
-- IMPORTANTE: Prima converte in lowercase, poi rimuove accenti e caratteri speciali
CREATE OR REPLACE FUNCTION normalize_slug(text)
RETURNS text AS $$
BEGIN
  -- Prima converte tutto in lowercase, poi rimuove accenti e caratteri speciali
  RETURN regexp_replace(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            regexp_replace(
              regexp_replace(
                lower($1), '[àáâãäå]', 'a', 'g'),
                '[èéêë]', 'e', 'g'
              ),
              '[ìíîï]', 'i', 'g'
            ),
            '[òóôõö]', 'o', 'g'
          ),
          '[ùúûü]', 'u', 'g'
        ),
        '[ç]', 'c', 'g'
      ),
      '[^a-z0-9]+', '-', 'g'
    );
END;
$$ LANGUAGE plpgsql;

-- Aggiorna gli URL mancanti o vuoti nella tabella voti_camera
-- Usa i dati dalla tabella users per costruire gli URL
UPDATE voti_camera vc
SET 
  url_openpolis = CASE 
    WHEN u.data_nascita IS NOT NULL THEN
      'https://parlamento19.openpolis.it/persone/' ||
      normalize_slug(u.nome) || '-' ||
      normalize_slug(u.cognome) || '-' ||
      to_char(u.data_nascita, 'YYYY-MM-DD')
    ELSE
      'https://parlamento19.openpolis.it/persone/' ||
      normalize_slug(u.nome) || '-' ||
      normalize_slug(u.cognome)
  END,
  ultimo_aggiornamento = CURRENT_TIMESTAMP
FROM users u
WHERE vc.politico_nome = CONCAT(u.nome, ' ', u.cognome)
  AND u.ruolo = 'P'
  AND (u.grado_elezione = 'C' OR u.grado_elezione = 'S')
  AND u.status = 'a'
  AND (
    vc.url_openpolis IS NULL 
    OR vc.url_openpolis = '' 
    OR TRIM(vc.url_openpolis) = ''
  );

-- Mostra statistiche sui risultati
SELECT 
  COUNT(*) as total_updated,
  COUNT(CASE WHEN url_openpolis LIKE '%-%-%-%' THEN 1 END) as with_date,
  COUNT(CASE WHEN url_openpolis NOT LIKE '%-%-%-%' THEN 1 END) as without_date
FROM voti_camera
WHERE politico_nome IN (
  SELECT CONCAT(nome, ' ', cognome) 
  FROM users 
  WHERE ruolo = 'P' 
    AND (grado_elezione = 'C' OR grado_elezione = 'S')
    AND status = 'a'
)
AND (
  url_openpolis IS NOT NULL 
  AND url_openpolis != '' 
  AND TRIM(url_openpolis) != ''
);

-- Mostra alcuni esempi di URL aggiornati
SELECT 
  politico_nome,
  camera,
  url_openpolis,
  ultimo_aggiornamento
FROM voti_camera
WHERE politico_nome IN (
  SELECT CONCAT(nome, ' ', cognome) 
  FROM users 
  WHERE ruolo = 'P' 
    AND (grado_elezione = 'C' OR grado_elezione = 'S')
    AND status = 'a'
)
AND (
  url_openpolis IS NOT NULL 
  AND url_openpolis != '' 
  AND TRIM(url_openpolis) != ''
)
ORDER BY ultimo_aggiornamento DESC
LIMIT 10;
