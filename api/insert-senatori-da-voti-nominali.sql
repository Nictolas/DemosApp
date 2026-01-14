-- Script per inserire i senatori dalla tabella parlamento_voti_nominali nella tabella users
-- Solo per i senatori (camera = 'Senato') che non esistono già
-- Con ruolo = 'P' e grado_elezione = 'S'

-- Funzione helper per estrarre nome e cognome
-- Assumiamo che il nome sia la prima parola e il cognome sia tutto il resto
WITH senatori_unici AS (
  SELECT DISTINCT
    nome_politico,
    -- Estrae il nome (prima parola)
    SPLIT_PART(nome_politico, ' ', 1) as nome,
    -- Estrae il cognome (tutto tranne la prima parola)
    CASE 
      WHEN LENGTH(nome_politico) - LENGTH(REPLACE(nome_politico, ' ', '')) = 0 THEN ''
      ELSE SUBSTRING(nome_politico FROM POSITION(' ' IN nome_politico) + 1)
    END as cognome
  FROM parlamento_voti_nominali
  WHERE camera = 'Senato'
    AND nome_politico IS NOT NULL
    AND nome_politico != ''
    AND LENGTH(SPLIT_PART(nome_politico, ' ', 1)) >= 2
)
-- Inserisce i senatori che non esistono già
INSERT INTO users (nome, cognome, ruolo, grado_elezione, status)
SELECT 
  su.nome,
  su.cognome,
  'P' as ruolo,
  'S' as grado_elezione,
  'a' as status
FROM senatori_unici su
WHERE NOT EXISTS (
  SELECT 1 
  FROM users u
  WHERE u.ruolo = 'P'
    AND u.grado_elezione = 'S'
    AND (
      -- Match esatto: nome e cognome corrispondono
      (u.nome = su.nome AND u.cognome = su.cognome)
      -- Match parziale: il nome completo corrisponde a nome + cognome
      OR CONCAT(u.nome, ' ', u.cognome) = su.nome_politico
      OR u.cognome = su.nome_politico
    )
);

-- Mostra statistiche
SELECT 
  'Senatori inseriti' as report,
  COUNT(*) as totale
FROM users
WHERE ruolo = 'P' AND grado_elezione = 'S';

-- Mostra alcuni esempi dei senatori inseriti
SELECT 
  nome, 
  cognome, 
  ruolo, 
  grado_elezione, 
  status
FROM users
WHERE ruolo = 'P' AND grado_elezione = 'S'
ORDER BY cognome, nome
LIMIT 20;
