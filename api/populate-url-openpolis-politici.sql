-- Script per popolare/aggiornare gli URL Openpolis per tutti i politici
-- Inserisce i politici mancanti in voti_camera e aggiorna gli URL mancanti
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

-- STEP 1: Inserisci i politici mancanti in voti_camera con URL generati
INSERT INTO voti_camera (politico_nome, camera, url_openpolis)
SELECT DISTINCT ON (politico_nome)
  politico_nome,
  camera,
  url_openpolis
FROM (
  SELECT 
    CONCAT(u.nome, ' ', u.cognome) as politico_nome,
    CASE 
      WHEN u.grado_elezione = 'C' THEN 'Camera'
      WHEN u.grado_elezione = 'S' THEN 'Senato'
      ELSE 'Camera'
    END as camera,
    CASE 
      WHEN u.data_nascita IS NOT NULL THEN
        'https://parlamento19.openpolis.it/persone/' ||
        normalize_slug(u.nome) || '-' ||
        normalize_slug(u.cognome) || '-' ||
        to_char(u.data_nascita, 'YYYY-MM-DD')
      ELSE
        'https://parlamento19.openpolis.it/persone/' ||
        normalize_slug(u.nome) || '-' ||
        normalize_slug(u.cognome)
    END as url_openpolis
  FROM users u
  WHERE u.ruolo = 'P' 
    AND (u.grado_elezione = 'C' OR u.grado_elezione = 'S')
    AND u.status = 'a'
    AND NOT EXISTS (
      SELECT 1 FROM voti_camera vc 
      WHERE vc.politico_nome = CONCAT(u.nome, ' ', u.cognome)
    )
) AS politici_unici
ON CONFLICT (politico_nome) DO NOTHING;

-- STEP 2: Aggiorna gli URL mancanti o vuoti per i politici già presenti in voti_camera
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

-- STEP 3: Aggiorna anche la camera se non corrisponde
UPDATE voti_camera vc
SET 
  camera = CASE 
    WHEN u.grado_elezione = 'C' THEN 'Camera'
    WHEN u.grado_elezione = 'S' THEN 'Senato'
    ELSE vc.camera
  END,
  ultimo_aggiornamento = CURRENT_TIMESTAMP
FROM users u
WHERE vc.politico_nome = CONCAT(u.nome, ' ', u.cognome)
  AND u.ruolo = 'P'
  AND (u.grado_elezione = 'C' OR u.grado_elezione = 'S')
  AND u.status = 'a'
  AND (
    (u.grado_elezione = 'C' AND vc.camera != 'Camera') OR
    (u.grado_elezione = 'S' AND vc.camera != 'Senato')
  );

-- Mostra statistiche sui risultati
SELECT 
  'Statistiche URL Openpolis' as report,
  COUNT(*) as total_politici,
  COUNT(CASE WHEN url_openpolis IS NOT NULL AND url_openpolis != '' AND TRIM(url_openpolis) != '' THEN 1 END) as con_url,
  COUNT(CASE WHEN url_openpolis IS NULL OR url_openpolis = '' OR TRIM(url_openpolis) = '' THEN 1 END) as senza_url,
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

-- Mostra alcuni esempi di politici con URL aggiornati
SELECT 
  'Esempi URL aggiornati' as report,
  vc.politico_nome,
  vc.camera,
  vc.url_openpolis,
  u.data_nascita,
  vc.ultimo_aggiornamento
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
ORDER BY vc.ultimo_aggiornamento DESC NULLS LAST, vc.politico_nome
LIMIT 20;
