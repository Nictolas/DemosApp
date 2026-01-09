-- Script per popolare la tabella voti_camera con tutti i politici dalla tabella users
-- Costruisce automaticamente gli URL Openpolis usando nome, cognome e data di nascita

-- Funzione helper per normalizzare i nomi (rimuove accenti, caratteri speciali)
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

-- Inserisci tutti i politici dalla tabella users in voti_camera
-- Costruisce gli URL automaticamente usando nome, cognome e data di nascita
-- Usa DISTINCT ON per evitare duplicati se ci sono più utenti con lo stesso nome
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
ON CONFLICT (politico_nome) 
DO UPDATE SET 
  camera = EXCLUDED.camera,
  url_openpolis = EXCLUDED.url_openpolis,
  ultimo_aggiornamento = CURRENT_TIMESTAMP;

-- Mostra il risultato
SELECT 
  COUNT(*) as total_inserted,
  COUNT(CASE WHEN url_openpolis LIKE '%-%-%-%' THEN 1 END) as with_date,
  COUNT(CASE WHEN url_openpolis NOT LIKE '%-%-%-%' THEN 1 END) as without_date
FROM voti_camera
WHERE politico_nome IN (
  SELECT CONCAT(nome, ' ', cognome) 
  FROM users 
  WHERE ruolo = 'P' 
    AND (grado_elezione = 'C' OR grado_elezione = 'S')
    AND status = 'a'
);

