-- Chi ha proposto l'opinione "Votare Mattia come Nuovo Napoleone"?
-- Eseguire in Neon SQL Editor.
-- Richiede che la colonna users.opinione_proposta_id esista (add-users-opinione-proposta-id.sql).

-- 1) Trova l'id dell'opinione (prova prima opinioni_proposte, poi opinioni_domande)
WITH opinione AS (
  SELECT id, text FROM opinioni_proposte
  WHERE LOWER(TRIM(text)) LIKE '%votare mattia come nuovo napoleone%'
  LIMIT 1
)
SELECT
  o.id AS opinione_id,
  o.text AS opinione_testo,
  u.id AS utente_id,
  u.nome,
  u.cognome,
  u.email
FROM opinione o
LEFT JOIN users u ON u.opinione_proposta_id = o.id;

-- Se la tabella opinioni_proposte non esiste o l'opinione è ancora in opinioni_domande, usa questa variante:
/*
WITH opinione AS (
  SELECT id, text FROM opinioni_domande
  WHERE LOWER(TRIM(text)) LIKE '%votare mattia come nuovo napoleone%'
  AND (gradi_opinione::text LIKE '%da approvare%' OR gradi_opinioni::text LIKE '%da approvare%')
  LIMIT 1
)
SELECT o.id, o.text, u.id AS utente_id, u.nome, u.cognome, u.email
FROM opinione o
LEFT JOIN users u ON u.opinione_proposta_id = o.id;
*/
