-- Script per correggere tutti gli URL Openpolis nella tabella voti_camera
-- Rigenera gli URL usando la funzione normalize_slug corretta (che converte prima in lowercase)

-- Funzione helper corretta per normalizzare i nomi
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

-- Aggiorna TUTTI gli URL nella tabella voti_camera con quelli corretti
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
  AND u.status = 'a';

-- Mostra statistiche sui risultati
SELECT 
  'URL corretti' as report,
  COUNT(*) as total_politici,
  COUNT(CASE WHEN url_openpolis IS NOT NULL AND url_openpolis != '' AND TRIM(url_openpolis) != '' THEN 1 END) as con_url,
  COUNT(CASE WHEN url_openpolis LIKE '%-%-%-%' THEN 1 END) as url_con_data,
  COUNT(CASE WHEN url_openpolis NOT LIKE '%-%-%-%' AND url_openpolis IS NOT NULL AND url_openpolis != '' THEN 1 END) as url_senza_data
FROM voti_camera
WHERE politico_nome IN (
  SELECT CONCAT(nome, ' ', cognome) 
  FROM users 
  WHERE ruolo = 'P' 
    AND (grado_elezione = 'C' OR grado_elezione = 'S')
    AND status = 'a'
);

-- Mostra alcuni esempi di URL corretti
SELECT 
  'Esempi URL corretti' as report,
  vc.politico_nome,
  vc.camera,
  vc.url_openpolis,
  u.data_nascita
FROM voti_camera vc
JOIN users u ON vc.politico_nome = CONCAT(u.nome, ' ', u.cognome)
WHERE u.ruolo = 'P' 
  AND (u.grado_elezione = 'C' OR u.grado_elezione = 'S')
  AND u.status = 'a'
  AND (
    vc.url_openpolis IS NOT NULL 
    AND vc.url_openpolis != '' 
    AND TRIM(vc.url_openpolis) != ''
  )
ORDER BY vc.politico_nome
LIMIT 20;
